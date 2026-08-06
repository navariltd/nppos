"""Push handlers for the NPPOS offline sync API.

Each handler applies a single queued business transaction from the device
outbox. Entitlement Redemptions are idempotent on the plain ``client_ref``
field (the unique idempotency key installed on that doctype only); the other
documents (POS Opening/Closing, Stock Entry) carry no idempotency key and are
created fresh on each accepted push.
"""

import frappe
from frappe import _
from frappe.utils import nowdate

from .sync_utils import (
    accepted,
    default_company,
    default_mode_of_payment,
    existing,
    rejected,
    server_dt,
)


def _close_stale_openings(pos_profile, user):
    """ERPNext refuses a new POS Opening Entry while one is still Open for the
    same profile OR user (POSOpeningEntry.check_open_pos_exists /
    check_user_already_assigned). An agent can't hold two sessions at once, so an
    Open entry here is an orphan from a previous run (e.g. the device wiped its
    local session before the close synced). We CLOSE those orphans with a proper
    POS Closing Entry (preserving the audit trail) so the new opening can submit;
    cancelling is only a last-ditch fallback."""
    orphans = set()
    for f in ({"pos_profile": pos_profile, "status": "Open"}, {"user": user, "status": "Open"}):
        orphans.update(frappe.get_all("POS Opening Entry", filters=f, pluck="name"))
    for name in orphans:
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
        # NEVER cancel a real opening — that destroys the shift's audit trail.
        frappe.db.set_value("POS Opening Entry", opening_name, "status", "Closed")


def push_pos_opening(client_ref, created_at, payload):
    """Create + submit a POS Opening Entry from the device (not idempotent)."""
    profile_name = payload["posProfile"]
    pos_profile = frappe.get_doc("POS Profile", profile_name)
    _close_stale_openings(profile_name, frappe.session.user)
    doc = frappe.new_doc("POS Opening Entry")
    doc.pos_profile = profile_name
    doc.company = pos_profile.company
    doc.user = frappe.session.user
    doc.period_start_date = server_dt(created_at)
    doc.posting_date = nowdate()
    doc.append(
        "balance_details",
        {
            "mode_of_payment": default_mode_of_payment(profile_name),
            "opening_amount": payload.get("openingFloat") or 0,
        },
    )
    doc.insert(ignore_permissions=True)
    doc.submit()
    return accepted(doc.name)


def push_pos_closing(client_ref, created_at, payload):
    """Create + submit a POS Closing Entry from the device (not idempotent)."""
    session = payload.get("session")
    opening_name = frappe.db.get_value("POS Opening Entry", session, "name")
    if not opening_name:
        return rejected(_("Opening entry not found for this session."))
    opening = frappe.get_doc("POS Opening Entry", opening_name)

    doc = frappe.new_doc("POS Closing Entry")
    doc.pos_opening_entry = opening_name
    doc.pos_profile = opening.pos_profile
    doc.company = opening.company
    doc.user = opening.user
    doc.period_start_date = opening.period_start_date
    doc.period_end_date = server_dt(created_at)
    doc.posting_date = nowdate()
    doc.append(
        "payment_reconciliation",
        {
            "mode_of_payment": default_mode_of_payment(opening.pos_profile),
            "opening_amount": payload.get("openingFloat") or 0,
            "expected_amount": payload.get("expectedCash") or 0,
            "closing_amount": payload.get("countedCash") or 0,
            "difference": payload.get("difference") or 0,
        },
    )
    doc.insert(ignore_permissions=True)
    doc.submit()
    return accepted(doc.name)


def _redeem_voucher(client_ref, payload, entitlement_type):
    """Voucher flow → Entitlement Redemption (insert+submit); its controller
    auto-creates the Payment Entry (Cash) or Stock Entry (Goods) — we do not
    create those separately. Idempotent on client_ref (unique field installed on
    Entitlement Redemption). Supports partial redemption: the device sends the
    actual amount/qty (≤ the voucher's)."""
    existing_doc = existing("Entitlement Redemption", client_ref)
    if existing_doc:
        return accepted(existing_doc, related={"entitlement_redemption": existing_doc})

    voucher_no = payload["voucherNo"]  # == Entitlement Voucher name
    ev = frappe.get_doc("Entitlement Voucher", voucher_no)

    red = frappe.new_doc("Entitlement Redemption")
    red.entitlement_voucher = voucher_no
    red.entitlement_type = entitlement_type
    red.posting_date = nowdate()
    red.client_ref = client_ref
    red.sync_status = "Synced"  # created via the offline push flow
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
        # The web app sends the opening doc name; the mobile app sends the
        # client_ref (session id) which is the opening doc name or its client_ref.
        pos_profile_name = frappe.db.get_value(
            "POS Opening Entry", payload["posSession"], "pos_profile"
        )
        if pos_profile_name:
            red.pos_profile = pos_profile_name
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
    return accepted(spawned or red.name, related=related)


def push_cash_payment(client_ref, created_at, payload):
    """Idempotently apply a cash entitlement redemption."""
    if not payload.get("voucherNo"):
        return rejected(_("Cash payment is missing a voucher."))
    return _redeem_voucher(client_ref, payload, entitlement_type="Cash")


def push_goods_issue(client_ref, created_at, payload):
    """Idempotently apply a goods entitlement redemption."""
    if not payload.get("voucherNo"):
        return rejected(_("Goods issue is missing a voucher."))
    return _redeem_voucher(client_ref, payload, entitlement_type="Goods")


def push_stock_adjustment(client_ref, created_at, payload):
    """Create + submit a Material Issue Stock Entry (not idempotent)."""
    se = frappe.new_doc("Stock Entry")
    se.stock_entry_type = "Material Issue"
    se.company = default_company()
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
    return accepted(se.name)


# Dispatch table for sync_push payload `kind`s.
HANDLERS = {
    "pos_opening": push_pos_opening,
    "pos_closing": push_pos_closing,
    "cash_payment": push_cash_payment,
    "goods_issue": push_goods_issue,
    "stock_return": push_stock_adjustment,
    "stock_damaged": push_stock_adjustment,
}
