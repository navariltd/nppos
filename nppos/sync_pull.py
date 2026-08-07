"""Delta-pull builder for the NPPOS offline sync API.

Builds the payload the agent's device receives from ``sync_pull``: assignments
(ADA), vouchers with folded entitlement state, hampers (BOM-expanded) and agent
stock levels, all scoped to the agent's distribution-enabled POS profile
warehouses. Idempotent — the device upserts what it receives.
"""

import frappe
from frappe.utils import get_datetime, now

from .sync_utils import COLLECTIONS, agent_pos_profiles, employee_for


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


def _assignments(employee, cursor):
    """Delta of the agent-scoped ADA assignments.

    Reads the FULL set to build the project→ADA map (voucher.assignment_id
    resolution needs every ADA), but only returns the delta so unchanged
    assignments aren't re-sent every pull.
    """
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
    if cursor:
        cutoff = get_datetime(cursor)
        adas = [a for a in adas_all if a.modified and get_datetime(a.modified) > cutoff]
    else:
        adas = adas_all
    return [
        {
            "id": a.name,
            "agent_id": employee,
            "project": a.project or "",
            "disbursement_order": a.disbursement_order or None,
            "date": str(a.date) if a.date else None,
            "amount_to_disburse": a.amount_to_disburse or 0,
        }
        for a in adas
    ], {a.project: a.name for a in adas_all if a.project}


def _redeemed_totals(voucher_names, warehouses):
    """Aggregated redeemed amount/qty/uses per voucher across the warehouses."""
    redeemed = {}  # voucher name -> {"amount": x, "qty": y, "uses": n}
    if voucher_names:
        for r in frappe.get_all(
            "Entitlement Redemption",
            filters={
                "warehouse": ["in", warehouses],
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
    return redeemed


def _vouchers(voucher_names, warehouses, redeemed, project_to_ada):
    """Serialize the vouchers being returned, folding entitlement state inline."""
    voucher_rows = (
        frappe.get_all(
            "Entitlement Voucher",
            filters={
                "name": ["in", list(voucher_names)],
                "warehouse": ["in", warehouses],
                "docstatus": 1,
            },
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
                "image",
            ],
        )
        if voucher_names
        else []
    )
    goods_item_codes = set()
    vouchers = []
    for v in voucher_rows:
        is_goods = v.entitlement_type == "Goods"
        agg = redeemed.get(v.name, {"amount": 0, "qty": 0, "uses": 0})
        status = _voucher_status(v, is_goods, agg)
        # Full doc so the offline-first web app can reconstruct every field
        # (company, cost_center, paid_from/to, bank_account, etc.) needed to
        # create a redemption locally.
        full_doc = frappe.get_doc("Entitlement Voucher", v.name).as_dict()
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
                "image": v.image or None,
                "doc": full_doc,  # full Entitlement Voucher document
            }
        )
        if is_goods and v.item:
            goods_item_codes.add(v.item)
    return vouchers, goods_item_codes


def _agent_stock(warehouses, goods_item_codes):
    """Bin levels across the POS-profile warehouses for the goods items."""
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
    return agent_stock


def build_pull_payload(cursors=None):
    """Build the delta-pull payload for the authenticated agent.

    Every collection is returned in full (the agent's slice is tiny) and the
    device upserts idempotently; cursors are echoed but not used to trim most
    collections yet. Vouchers ARE delta-filtered to avoid re-sending unchanged
    rows, plus any voucher touched by a redemption since the cursor.

    Args:
        cursors: dict of collection → last-sync timestamp (optional).

    Returns:
        dict: assignments, vouchers, hampers, agent_stock, pos_profiles, cursors.
    """
    user = frappe.session.user
    employee = employee_for(user)
    stamp = now()

    empty = {
        "assignments": [],
        "vouchers": [],
        "hampers": [],
        "agent_stock": [],
        "pos_profiles": [],
        "cursors": {k: stamp for k in COLLECTIONS},
    }

    pos_profiles = agent_pos_profiles(user, employee)
    # Filter data by the POS profile's warehouse(s) — NOT by user/employee.
    warehouses = sorted({p["warehouse"] for p in pos_profiles if p["warehouse"]})
    # If the user has no distribution-enabled profile/warehouse, return empty
    if not warehouses:
        return empty

    # ---- assignments (ADA) ----
    assignments, project_to_ada = _assignments(employee, cursors.get("assignments"))

    # ---- which vouchers to return (DELTA) ----
    # New/edited since the device's cursor, PLUS any voucher touched by a
    # redemption since the cursor (a redemption changes redeemed_amount but does
    # NOT bump the voucher's own `modified`). No cursor → full set (first pull).
    v_cursor = cursors.get("vouchers")
    v_filters = {"warehouse": ["in", warehouses], "docstatus": 1}
    if v_cursor:
        v_filters["modified"] = [">", v_cursor]
    voucher_names = set(
        frappe.get_all("Entitlement Voucher", filters=v_filters, pluck="name")
    )
    if v_cursor:
        for red_v in frappe.get_all(
            "Entitlement Redemption",
            filters={
                "warehouse": ["in", warehouses],
                "docstatus": 1,
                "modified": [">", v_cursor],
            },
            pluck="entitlement_voucher",
        ):
            if red_v:
                voucher_names.add(red_v)

    # ---- redeemed totals + vouchers ----
    redeemed = _redeemed_totals(voucher_names, warehouses)
    vouchers, goods_item_codes = _vouchers(
        voucher_names, warehouses, redeemed, project_to_ada
    )

    # ---- hampers + agent stock ----
    hampers = [_hamper_for(code) for code in goods_item_codes]
    agent_stock = _agent_stock(warehouses, goods_item_codes)

    return {
        "assignments": assignments,
        "vouchers": vouchers,
        "hampers": hampers,
        "agent_stock": agent_stock,
        "pos_profiles": pos_profiles,
        "cursors": {k: stamp for k in COLLECTIONS},
    }