# Three whitelisted endpoints the offline-first React Native app talks to.
#
#   POST /api/method/nppos.sync_api.login       {email, password}
#   POST /api/method/nppos.sync_api.sync_pull   {cursors}
#   POST /api/method/nppos.sync_api.sync_push   {client_ref, created_at, payload}
#
# Design notes:
#   * Idempotency is load-bearing. Every doc a push creates carries
#     custom_client_ref == client_ref (a unique Data field installed by
#     nppos/install.py on Entitlement Redemption, Stock Entry, POS Opening/Closing
#     Entry). A re-push of the same client_ref returns the existing doc instead of
#     creating a duplicate, so device retries after a mid-sync drop are safe.
#   * A push returns exactly one of {"status": "accepted", ...} or
#     {"status": "rejected", "reason": ...} (both HTTP 200). Business refusals
#     become "rejected"; transient/unexpected errors bubble as 5xx so the device
#     backs off and retries.
#   * Only voucher flows exist: cash_payment and goods_issue are ALWAYS
#     Entitlement Redemptions. There is no beneficiary/DO/project pull — the agent
#     works vouchers, grouped by the agent-scoped ADA (assignments).

import json

import frappe
from frappe import _
from frappe.utils import get_datetime, now, nowdate

# Roles that make a user an "admin" to the app; everyone else is an "agent".
ADMIN_ROLES = {"System Manager", "Non Profit Admin"}

# Wire keys the device expects on `cursors` (camelCase — the app maps arrays
# snake→camel itself but passes `cursors` through untouched).
_COLLECTIONS = ["assignments", "vouchers", "hampers", "agentStock", "posProfiles"]


def _parse(value):
    """Payload may arrive as a dict (JSON body) or a JSON string (form-encoded)."""
    if isinstance(value, str):
        return json.loads(value)
    return value or {}


def _employee_for(user):
    """The Employee (agent) linked to a Frappe user, or None."""
    return frappe.db.get_value("Employee", {"user_id": user}, "name")


def _agent_pos_profiles(user, employee):
    """Distribution-enabled POS Profiles available to this user, in pull shape.

    Scoped by the POS Profile's applicable-users child table (a profile with no
    applicable users is available to everyone — ERPNext semantics)."""
    rows = frappe.get_all(
        "POS Profile",
        filters={"enable_entitlement_distribution": 1, "disabled": 0},
        fields=["name", "warehouse", "currency"],
    )
    out = []
    for r in rows:
        applicable = frappe.get_all(
            "POS Profile User",
            filters={"parent": r.name},
            pluck="user",
        )
        if applicable and user not in applicable:
            continue
        out.append(
            {
                "id": r.name,
                "name": r.name,
                "agent_id": employee or user,
                "warehouse": r.warehouse or "",
                "currency": r.currency or "",
            }
        )
    return out


def _default_company():
    return frappe.defaults.get_user_default("Company") or frappe.db.get_single_value(
        "Global Defaults", "default_company"
    )


def _existing(doctype, client_ref):
    """Name of a doc already created for this client_ref (idempotency), or None."""
    if not client_ref:
        return None
    return frappe.db.get_value(doctype, {"custom_client_ref": client_ref}, "name")


def _accepted(server_name, related=None):
    out = {"status": "accepted", "server_name": server_name}
    if related:
        out["related"] = related
    return out


def _rejected(reason):
    return {"status": "rejected", "reason": reason}


def _server_dt(value):
    """Normalise a device ISO-8601 timestamp (e.g. '2026-07-23T11:17:16.742Z')
    to a MySQL-safe 'YYYY-MM-DD HH:MM:SS' datetime; fall back to server time."""
    if value:
        try:
            from datetime import datetime

            return datetime.fromisoformat(str(value).replace("Z", "+00:00")).strftime(
                "%Y-%m-%d %H:%M:%S"
            )
        except Exception:
            pass
    return frappe.utils.now_datetime()


def _default_mode_of_payment(pos_profile_name):
    """The POS Profile's default mode of payment, falling back to 'Cash'."""
    try:
        pos_profile = frappe.get_doc("POS Profile", pos_profile_name)
        for p in pos_profile.get("payments", []):
            if p.default:
                return p.mode_of_payment
        if pos_profile.get("payments"):
            return pos_profile.payments[0].mode_of_payment
    except Exception:
        pass
    return "Cash"


@frappe.whitelist(allow_guest=True)
def login(email=None, password=None):
    """Validate credentials, (re)issue an API key/secret, return the agent
    profile and their distribution-enabled POS profiles."""
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

    employee = _employee_for(email)
    pos_profiles = _agent_pos_profiles(email, employee)
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
    """Delta-pull the authenticated agent's slice. The agent's slice is tiny, so
    every collection is returned in full each pull and the device upserts
    idempotently — cursors are still echoed for a future optimisation pass."""
    cursors = _parse(cursors)
    user = frappe.session.user
    employee = _employee_for(user)
    stamp = now()

    empty = {
        "assignments": [],
        "vouchers": [],
        "hampers": [],
        "agent_stock": [],
        "pos_profiles": [],
        "cursors": {k: stamp for k in _COLLECTIONS},
    }
    if not employee:
        return empty

    pos_profiles = _agent_pos_profiles(user, employee)

    # ---- assignments (ADA) — the agent-scoped grouping ----
    # The ADA doctype lives in aigt_hdr; guard so nppos still works standalone.
    # We read the FULL set to build the project→ADA map (voucher.assignment_id
    # resolution needs every ADA), but only RETURN the delta so unchanged
    # assignments aren't re-sent every pull.
    a_cursor = cursors.get("assignments")
    adas_all = []
    if frappe.db.exists("DocType", "Agent Disbursement Assignment"):
        adas_all = frappe.get_all(
            "Agent Disbursement Assignment",
            filters={"agent": employee, "docstatus": 1},
            fields=[
                "name",
                "disbursement_order",
                "project",
                "date",
                "amount_to_disburse",
                "modified",
            ],
        )
    project_to_ada = {a.project: a.name for a in adas_all if a.project}
    if a_cursor:
        cutoff = get_datetime(a_cursor)
        adas = [a for a in adas_all if a.modified and get_datetime(a.modified) > cutoff]
    else:
        adas = adas_all
    assignments = [
        {
            "id": a.name,
            "agent_id": employee,
            "project": a.project or "",
            "disbursement_order": a.disbursement_order or None,
            "date": str(a.date) if a.date else None,
            "amount_to_disburse": a.amount_to_disburse or 0,
        }
        for a in adas
    ]

    # ---- which vouchers to return (DELTA) ----
    # New/edited since the device's cursor, PLUS any voucher touched by a
    # redemption since the cursor (a redemption changes redeemed_amount but does
    # NOT bump the voucher's own `modified`, so we'd otherwise miss it). No
    # cursor → full set (first pull). The device upserts idempotently and never
    # deletes, so sending only the delta is safe.
    v_cursor = cursors.get("vouchers")
    v_filters = {"agent": employee, "docstatus": 1}
    if v_cursor:
        v_filters["modified"] = [">", v_cursor]
    voucher_names = set(frappe.get_all("Entitlement Voucher", filters=v_filters, pluck="name"))
    if v_cursor:
        for red_v in frappe.get_all(
            "Entitlement Redemption",
            filters={"agent": employee, "docstatus": 1, "modified": [">", v_cursor]},
            pluck="entitlement_voucher",
        ):
            if red_v:
                voucher_names.add(red_v)

    # ---- redeemed totals + use counts (only for the vouchers we're returning) ----
    redeemed = {}  # voucher name -> {"amount": x, "qty": y, "uses": n}
    if voucher_names:
        for r in frappe.get_all(
            "Entitlement Redemption",
            filters={
                "agent": employee,
                "docstatus": 1,
                "entitlement_voucher": ["in", list(voucher_names)],
            },
            fields=["entitlement_voucher", "amount", "qty"],
        ):
            agg = redeemed.setdefault(
                r.entitlement_voucher, {"amount": 0, "qty": 0, "uses": 0}
            )
            agg["amount"] += r.amount or 0
            agg["qty"] += r.qty or 0
            agg["uses"] += 1

    # ---- vouchers (entitlement folded inline) ----
    vouchers = []
    goods_item_codes = set()
    voucher_rows = (
        frappe.get_all(
            "Entitlement Voucher",
            filters={"name": ["in", list(voucher_names)], "agent": employee, "docstatus": 1},
            fields=[
                "name",
                "entitlement_type",
                "status",
                "valid_from",
                "valid_to",
                "item",
                "qty",
                "uom",
                "rate",
                "amount",
                "project",
                "party",
            ],
        )
        if voucher_names
        else []
    )
    for v in voucher_rows:
        # docstatus is authoritative (the query already limits to submitted=1;
        # cancelled=2 is excluded). The Select `status` label is NOT managed by
        # the backend controller yet — submitted vouchers still read "Draft" —
        # so we DERIVE the app status from redemptions + validity instead of
        # trusting the label (docs/NPPOS_WEB.md gap #1).
        is_goods = v.entitlement_type == "Goods"
        agg = redeemed.get(v.name, {"amount": 0, "qty": 0, "uses": 0})
        status = _voucher_status(v, is_goods, agg)
        vouchers.append(
            {
                "id": v.name,
                "voucher_no": v.name,  # doc name == voucher_number
                "beneficiary_no": v.party or None,
                "entitlement_type": "hamper" if is_goods else "cash",
                "amount": v.amount or 0,
                "hamper_id": v.item if is_goods else None,
                "qty": v.qty if is_goods else None,
                "uom": v.uom if is_goods else None,
                "rate": v.rate if is_goods else None,
                "redeemed_amount": agg["amount"],
                "redeemed_qty": agg["qty"],
                "valid_from": str(v.valid_from) if v.valid_from else "",
                "valid_to": str(v.valid_to) if v.valid_to else "",
                "status": status,
                "uses_count": agg["uses"],
                "max_uses": 2,  # spec-level local rule; no backend counter yet
                "project": v.project or "",
                "assignment_id": project_to_ada.get(v.project),
            }
        )
        if is_goods and v.item:
            goods_item_codes.add(v.item)

    # ---- hampers (from goods voucher items; BOM-expanded when available) ----
    hampers = [_hamper_for(code) for code in goods_item_codes]

    # ---- agent stock (Bin levels across the agent's POS-profile warehouses) ----
    warehouses = sorted({p["warehouse"] for p in pos_profiles if p["warehouse"]})
    agent_stock = []
    if warehouses and goods_item_codes:
        for bin_row in frappe.get_all(
            "Bin",
            filters={
                "warehouse": ["in", warehouses],
                "item_code": ["in", list(goods_item_codes)],
            },
            fields=["warehouse", "item_code", "actual_qty"],
        ):
            agent_stock.append(
                {
                    "warehouse": bin_row.warehouse,
                    "hamper_id": bin_row.item_code,
                    "hamper_name": frappe.db.get_value(
                        "Item", bin_row.item_code, "item_name"
                    )
                    or bin_row.item_code,
                    "on_hand": bin_row.actual_qty or 0,
                    "issued_today": 0,
                    "damaged": 0,
                }
            )

    return {
        "assignments": assignments,
        "vouchers": vouchers,
        "hampers": hampers,
        "agent_stock": agent_stock,
        "pos_profiles": pos_profiles,
        "cursors": {k: stamp for k in _COLLECTIONS},
    }


def _voucher_status(v, is_goods, agg):
    """Derive the app-facing status (active | partially_redeemed | redeemed |
    expired) from validity + redemptions. The backend's Select `status` is not
    maintained on submit, so it can't be trusted (docs/NPPOS_WEB.md gap #1)."""
    from frappe.utils import getdate, nowdate

    if v.valid_to and getdate(v.valid_to) < getdate(nowdate()):
        return "expired"
    total = (v.qty or 0) if is_goods else (v.amount or 0)
    done = agg["qty"] if is_goods else agg["amount"]
    # max_uses is the spec-level 2 (no backend counter yet).
    if agg["uses"] >= 2 or (total and done >= total):
        return "redeemed"
    if agg["uses"] > 0:
        return "partially_redeemed"
    return "active"


def _hamper_for(item_code):
    """Represent an item as a hamper. If it has a default BOM, expand its
    components; otherwise it's a single-line hamper (the item itself)."""
    item_name = frappe.db.get_value("Item", item_code, "item_name") or item_code
    bom = frappe.db.get_value(
        "BOM", {"item": item_code, "is_default": 1, "is_active": 1}, "name"
    )
    items = []
    if bom:
        for bi in frappe.get_all(
            "BOM Item",
            filters={"parent": bom},
            fields=["item_name", "stock_uom", "qty"],
        ):
            items.append(
                {
                    "item_name": bi.item_name,
                    "unit": bi.stock_uom or "",
                    "qty_per_household": bi.qty or 0,
                }
            )
    if not items:
        items = [{"item_name": item_name, "unit": "", "qty_per_household": 1}]
    return {"id": item_code, "name": item_name, "items": items}


@frappe.whitelist()
def sync_push(client_ref=None, created_at=None, payload=None):
    """Apply one queued business transaction from the device outbox.

    Returns {"status": "accepted"|"rejected", ...}. The whole call is one DB
    transaction so a payload that creates several docs is all-or-nothing.
    """
    if not client_ref:
        frappe.throw(_("client_ref is required."))
    payload = _parse(payload)
    kind = payload.get("kind")

    handlers = {
        "pos_opening": _push_pos_opening,
        "pos_closing": _push_pos_closing,
        "cash_payment": _push_cash_payment,
        "goods_issue": _push_goods_issue,
        "stock_return": _push_stock_adjustment,
        "stock_damaged": _push_stock_adjustment,
    }
    handler = handlers.get(kind)
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
        return _rejected(str(e) or _("Rejected by the server."))


def _agent():
    return _employee_for(frappe.session.user)


def _close_stale_openings(pos_profile, user, keep_client_ref):
    """ERPNext refuses a new POS Opening Entry while one is still Open for the
    same profile OR user (POSOpeningEntry.check_open_pos_exists /
    check_user_already_assigned). An agent can't hold two sessions at once, so an
    Open entry here is an orphan from a previous run (e.g. the device wiped its
    local session before the close synced). We CLOSE those orphans with a proper
    POS Closing Entry (preserving the audit trail) so the new opening can submit;
    cancelling is only a last-ditch fallback. Never touch the one we're
    (re)creating for this ref."""
    orphans = set()
    for f in ({"pos_profile": pos_profile, "status": "Open"}, {"user": user, "status": "Open"}):
        orphans.update(frappe.get_all("POS Opening Entry", filters=f, pluck="name"))
    for name in orphans:
        if frappe.db.get_value("POS Opening Entry", name, "custom_client_ref") == keep_client_ref:
            continue
        _auto_close_orphan(name)


def _auto_close_orphan(opening_name):
    """Close an abandoned session at its opening float (no counted-cash info is
    available for an orphan, so expected == closing == opening, difference 0)."""
    opening = frappe.get_doc("POS Opening Entry", opening_name)
    doc = frappe.new_doc("POS Closing Entry")
    doc.pos_opening_entry = opening_name
    doc.pos_profile = opening.pos_profile
    doc.company = opening.company
    doc.user = opening.user
    doc.period_start_date = opening.period_start_date
    doc.period_end_date = frappe.utils.now_datetime()
    doc.posting_date = nowdate()
    for bd in opening.balance_details:
        amt = bd.opening_amount or 0
        doc.append(
            "payment_reconciliation",
            {
                "mode_of_payment": bd.mode_of_payment,
                "opening_amount": amt,
                "expected_amount": amt,
                "closing_amount": amt,
                "difference": 0,
            },
        )
    try:
        doc.insert(ignore_permissions=True)
        doc.submit()  # on_submit flips the opening to "Closed"
    except Exception:
        # Couldn't close cleanly — cancel (last resort) so it stops blocking.
        try:
            o = frappe.get_doc("POS Opening Entry", opening_name)
            o.flags.ignore_permissions = True
            o.cancel()
        except Exception:
            frappe.db.set_value("POS Opening Entry", opening_name, "status", "Closed")


def _push_pos_opening(client_ref, created_at, payload):
    existing = _existing("POS Opening Entry", client_ref)
    if existing:
        return _accepted(existing)

    profile_name = payload["posProfile"]
    pos_profile = frappe.get_doc("POS Profile", profile_name)
    _close_stale_openings(profile_name, frappe.session.user, client_ref)
    doc = frappe.new_doc("POS Opening Entry")
    doc.pos_profile = profile_name
    doc.company = pos_profile.company
    doc.user = frappe.session.user
    doc.period_start_date = _server_dt(created_at)
    doc.posting_date = nowdate()
    doc.custom_client_ref = client_ref
    doc.append(
        "balance_details",
        {
            "mode_of_payment": _default_mode_of_payment(profile_name),
            "opening_amount": payload.get("openingFloat") or 0,
        },
    )
    doc.insert(ignore_permissions=True)
    doc.submit()
    return _accepted(doc.name)


def _push_pos_closing(client_ref, created_at, payload):
    existing = _existing("POS Closing Entry", client_ref)
    if existing:
        return _accepted(existing)

    # The opening entry is found by the session id the device stamped on it.
    opening_name = frappe.db.get_value(
        "POS Opening Entry", {"custom_client_ref": payload.get("session")}, "name"
    )
    if not opening_name:
        return _rejected(_("Opening entry not found for this session."))
    opening = frappe.get_doc("POS Opening Entry", opening_name)

    doc = frappe.new_doc("POS Closing Entry")
    doc.pos_opening_entry = opening_name
    doc.pos_profile = opening.pos_profile
    doc.company = opening.company
    doc.user = opening.user
    doc.period_start_date = opening.period_start_date
    doc.period_end_date = _server_dt(created_at)
    doc.posting_date = nowdate()
    doc.custom_client_ref = client_ref
    doc.append(
        "payment_reconciliation",
        {
            "mode_of_payment": _default_mode_of_payment(opening.pos_profile),
            "opening_amount": payload.get("openingFloat") or 0,
            "expected_amount": payload.get("expectedCash") or 0,
            "closing_amount": payload.get("countedCash") or 0,
            "difference": payload.get("difference") or 0,
        },
    )
    doc.insert(ignore_permissions=True)
    # A disbursement POS has no POS Invoices to fold in, so submit usually works;
    # if core validation refuses, keep the counted numbers as a draft.
    try:
        doc.submit()
    except frappe.ValidationError:
        frappe.db.rollback(save_point="push")
        doc = frappe.get_doc("POS Closing Entry", doc.name)  # re-read draft
    return _accepted(doc.name)


def _push_cash_payment(client_ref, created_at, payload):
    if not payload.get("voucherNo"):
        return _rejected(_("Cash payment is missing a voucher."))
    return _redeem_voucher(client_ref, payload, entitlement_type="Cash")


def _push_goods_issue(client_ref, created_at, payload):
    if not payload.get("voucherNo"):
        return _rejected(_("Goods issue is missing a voucher."))
    return _redeem_voucher(client_ref, payload, entitlement_type="Goods")


def _push_stock_adjustment(client_ref, created_at, payload):
    existing = _existing("Stock Entry", client_ref)
    if existing:
        return _accepted(existing)

    se = frappe.new_doc("Stock Entry")
    se.stock_entry_type = "Material Issue"
    se.company = _default_company()
    se.custom_client_ref = client_ref
    se.append(
        "items",
        {
            "item_code": payload["hamper"],
            "qty": payload["qty"],
            "s_warehouse": payload["warehouse"],
            "allow_zero_valuation_rate": 1,
            "conversion_factor": 1,
        },
    )
    se.insert(ignore_permissions=True)
    se.submit()
    return _accepted(se.name)


def _redeem_voucher(client_ref, payload, entitlement_type):
    """Voucher flow → Entitlement Redemption (insert+submit); its controller
    auto-creates the Payment Entry (Cash) or Stock Entry (Goods) — we do not
    create those separately. Idempotent on custom_client_ref. Supports partial
    redemption: the device sends the actual amount/qty (≤ the voucher's)."""
    existing = _existing("Entitlement Redemption", client_ref)
    if existing:
        return _accepted(existing, related={"entitlement_redemption": existing})

    voucher_no = payload["voucherNo"]  # == Entitlement Voucher name
    ev = frappe.get_doc("Entitlement Voucher", voucher_no)

    red = frappe.new_doc("Entitlement Redemption")
    red.entitlement_voucher = voucher_no
    red.entitlement_type = entitlement_type
    red.posting_date = nowdate()
    red.custom_client_ref = client_ref
    # copy descriptive/accounting context from the voucher
    for field in (
        "party_type",
        "party",
        "company",
        "project",
        "cost_center",
        "currency",
        "agent",
        "merchant",
        "warehouse",
        "item",
        "uom",
        "rate",
        "paid_from",
        "paid_to",
        "bank_account",
        "party_bank_account",
    ):
        val = ev.get(field)
        if val:
            red.set(field, val)
    # Goods draw from the session profile's warehouse if the device sent one.
    if entitlement_type == "Goods" and payload.get("warehouse"):
        red.warehouse = payload["warehouse"]
    if payload.get("posSession"):
        red.pos_profile = frappe.db.get_value(
            "POS Opening Entry",
            {"custom_client_ref": payload["posSession"]},
            "pos_profile",
        )
    if entitlement_type == "Cash":
        red.amount = payload.get("amount") or ev.amount
    else:
        red.qty = payload.get("qty") or ev.qty
        red.amount = ev.amount

    red.insert(ignore_permissions=True)
    red.submit()

    # The doc the controller spun off (Payment Entry or Stock Entry).
    spawn_dt = "Payment Entry" if entitlement_type == "Cash" else "Stock Entry"
    spawned = frappe.db.get_value(
        spawn_dt, {"entitlement_redemption": red.name}, "name"
    )
    related = {"entitlement_redemption": red.name}
    if spawned:
        related["payment_entry" if entitlement_type == "Cash" else "stock_entry"] = spawned
    return _accepted(spawned or red.name, related=related)
