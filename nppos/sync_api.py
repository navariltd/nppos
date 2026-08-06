"""Public whitelisted endpoints the offline-first React Native app talks to.

  POST /api/method/nppos.sync_api.login       {email, password}
  POST /api/method/nppos.sync_api.sync_pull   {cursors}
  POST /api/method/nppos.sync_api.sync_push   {client_ref, created_at, payload}

Design notes:
  * Redemption idempotency is load-bearing. Every Entitlement Redemption a push
    creates carries client_ref == client_ref (a unique Data field installed by
    nppos/install.py on Entitlement Redemption — the voucher flow's primary
    document). A re-push of the same client_ref returns the existing redemption
    instead of creating a duplicate, so device retries after a mid-sync drop are
    safe. POS Opening/Closing and Stock Entries are not idempotency-keyed.
  * A push returns exactly one of {"status": "accepted", ...} or
    {"status": "rejected", "reason": ...} (both HTTP 200). Business refusals
    become "rejected"; transient/unexpected errors bubble as 5xx so the device
    backs off and retries.
  * Only voucher flows exist: cash_payment and goods_issue are ALWAYS
    Entitlement Redemptions. There is no beneficiary/DO/project pull — the agent
    works vouchers, grouped by the agent-scoped ADA (assignments).

Heavy lifting lives in the sibling modules: ``sync_pull`` builds the delta-pull
payload and ``sync_handlers`` applies the push transactions; ``sync_utils``
holds the shared helpers.
"""

import frappe
from frappe import _

from .sync_handlers import HANDLERS
from .sync_pull import build_pull_payload
from .sync_utils import (
    ADMIN_ROLES,
    agent_pos_profiles,
    employee_for,
    parse,
)


@frappe.whitelist(allow_guest=True)
def login(email=None, password=None):
    """Validate credentials, (re)issue an API key/secret, return the agent
    profile and their distribution-enabled POS profiles.

    Args:
        email: user email.
        password: user password.

    Returns:
        dict: token (api_key:api_secret), agent profile and pos_profiles.

    Raises:
        frappe.AuthenticationError: invalid/disabled credentials.
    """
    from frappe.utils.password import check_password

    if not email or not password:
        raise frappe.AuthenticationError(_("Email and password are required."))

    try:
        check_password(email, password)
    except frappe.AuthenticationError:
        raise frappe.AuthenticationError(_("Invalid email or password."))

    user = frappe.get_doc("User", email)
    if not user.enabled:
        raise frappe.AuthenticationError(_("This account is disabled."))

    # (Re)issue keys. generate_keys() core helper requires System Manager, so we
    # replicate its logic and save with ignore_permissions.
    if not user.api_key:
        user.api_key = frappe.generate_hash(length=15)
    api_secret = frappe.generate_hash(length=15)
    user.api_secret = api_secret
    user.save(ignore_permissions=True)
    frappe.db.commit()

    roles = set(frappe.get_roles(email))
    role = "admin" if roles & ADMIN_ROLES else "agent"

    employee = employee_for(email)
    pos_profiles = agent_pos_profiles(email, employee)
    warehouse_code = pos_profiles[0]["warehouse"] if pos_profiles else ""

    return {
        "token": f"{user.api_key}:{api_secret}",
        "agent": {
            "id": employee or email,
            "name": user.full_name or email,
            "email": email,
            "warehouse_code": warehouse_code,
            "role": role,
            "region": (
                frappe.db.get_value("Employee", employee, "branch") or ""
                if employee
                else ""
            ),
        },
        "pos_profiles": pos_profiles,
    }


@frappe.whitelist()
def sync_pull(cursors=None):
    """Delta-pull the authenticated agent's slice (vouchers, stock, profiles).

    Args:
        cursors: dict of collection → last-sync timestamp (optional).

    Returns:
        dict: assignments, vouchers, hampers, agent_stock, pos_profiles, cursors.
    """
    cursors = parse(cursors)
    return build_pull_payload(cursors)


@frappe.whitelist()
def sync_push(client_ref=None, created_at=None, payload=None):
    """Apply one queued business transaction from the device outbox.

    Args:
        client_ref: idempotency key carried by every pushed doc.
        created_at: device ISO-8601 timestamp for the transaction.
        payload: dict/JSON-string describing the transaction (`kind` dispatches).

    Returns:
        dict: {"status": "accepted", ...} or {"status": "rejected", ...}.

    Raises:
        frappe.ValidationError: unknown kind or transactional failure rolled back.
    """
    if not client_ref:
        frappe.throw(_("client_ref is required."))
    payload = parse(payload)
    kind = payload.get("kind")

    handler = HANDLERS.get(kind)
    if not handler:
        frappe.throw(_("Unknown payload kind: {0}").format(kind))

    # Business refusals surface as ValidationError/MandatoryError → "rejected"
    # (HTTP 200; the device parks the row for admin review). Anything else
    # bubbles as 5xx so the device backs off and retries.
    frappe.db.savepoint("push")
    try:
        return handler(client_ref, created_at, payload)
    except (frappe.ValidationError, frappe.MandatoryError) as e:
        frappe.db.rollback(save_point="push")
        return {"status": "rejected", "reason": str(e) or _("Rejected by the server.")}