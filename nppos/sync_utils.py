"""Shared helpers for the NPPOS offline sync API.

Centralises payload parsing, idempotency lookups, response builders,
timestamp normalisation and agent/profile resolution so the public endpoints
in ``sync_api`` stay thin and the pull/push modules stay focused.
"""

import json

import frappe
from frappe import _

# Roles that make a user an "admin" to the app; everyone else is an "agent".
ADMIN_ROLES = {"System Manager", "Non Profit Admin"}

# Wire keys the device expects on `cursors` (camelCase — the app maps arrays
# snake→camel itself but passes `cursors` through untouched).
COLLECTIONS = ["assignments", "vouchers", "hampers", "agentStock", "posProfiles"]


def parse(value):
    """Payload may arrive as a dict (JSON body) or a JSON string (form-encoded)."""
    if isinstance(value, str):
        return json.loads(value)
    return value or {}


def employee_for(user):
    """The Employee (agent) linked to a Frappe user, or None."""
    return frappe.db.get_value("Employee", {"user_id": user}, "name")


def default_company():
    """Company to use on pushed docs when the payload omits one."""
    return frappe.defaults.get_user_default("Company") or frappe.db.get_single_value(
        "Global Defaults", "default_company"
    )


def existing(doctype, client_ref):
    """Name of a doc already created for this client_ref (idempotency), or None.

    Only Entitlement Redemption carries the plain ``client_ref`` unique field;
    other doctypes are not idempotency-keyed.
    """
    if not client_ref:
        return None
    return frappe.db.get_value(doctype, {"client_ref": client_ref}, "name")


def accepted(server_name, related=None):
    """Build the idempotent `accepted` push response."""
    out = {"status": "accepted", "server_name": server_name}
    if related:
        out["related"] = related
    return out


def rejected(reason):
    """Build the `rejected` push response for a business refusal."""
    return {"status": "rejected", "reason": reason}


def server_dt(value):
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


def default_mode_of_payment(pos_profile_name):
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


def agent_pos_profiles(user, employee):
    """Distribution-enabled POS Profiles available to this user, in pull shape.

    Scoped by the POS Profile's applicable-users child table (a profile with no
    applicable users is available to everyone — ERPNext semantics).
    """
    rows = frappe.get_all(
        "POS Profile",
        filters={"enable_entitlement_distribution": 1, "disabled": 0},
        fields=["name", "warehouse", "currency"],
    )
    out = []
    for r in rows:
        applicable = frappe.get_all(
            "POS Profile User", filters={"parent": r.name}, pluck="user"
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