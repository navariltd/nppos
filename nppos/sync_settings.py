"""POS-app settings — the "POS App" tab of AIGT HDR Settings, as the device
receives it on every pull.

The mobile app hard-codes nothing that has a setting here: the object below is
sent IN FULL on every ``sync_pull`` (it is ~8 scalars, so a delta/cursor would
cost more than it saves) and the device replaces its local copy wholesale.

aigt_hdr is NOT a dependency of nppos (hooks.py: ``required_apps = ["erpnext"]``),
so every read is guarded and falls back to the defaults below — same pattern as
``_beneficiaries`` in sync_pull.py. The defaults must equal the app's own
built-in defaults (mobile ``src/lib/pos-settings.ts``); keep the two in step.
"""

import frappe

# wire key → (settings fieldname, default)
FIELDS = {
    "max_offline_hours": ("pos_max_offline_hours", 72),
    "transaction_retention": ("pos_transaction_retention", 500),
    "show_redeemed_vouchers": ("pos_show_redeemed_vouchers", 1),
    "max_uses_cash": ("pos_max_uses_cash", 2),
    "max_uses_goods": ("pos_max_uses_goods", 1),
    "show_hamper_contents": ("pos_show_hamper_contents", 1),
    "show_beneficiary_details": ("pos_show_beneficiary_details", 1),
    "require_close_out_photo": ("pos_require_close_out_photo", 0),
}


def pos_settings():
    """The full settings object — every key present, ints only (Checks are 0/1).

    ``get_cached_doc`` is invalidated when the Single is saved, so a desk change
    reaches the next pull without a restart.
    """
    doc = None
    if frappe.db.exists("DocType", "AIGT HDR Settings"):
        doc = frappe.get_cached_doc("AIGT HDR Settings")

    out = {}
    for key, (fieldname, default) in FIELDS.items():
        value = doc.get(fieldname) if doc else None
        out[key] = default if value in (None, "") else int(value)
    return out


def max_uses_for(entitlement_type, settings=None):
    """Configured redemption limit for 'Cash' | 'Goods' (backend vocabulary).

    Read at redemption time on BOTH sides (device and submit hook), so changing
    it applies to future redemptions only. Never below 1.
    """
    settings = settings or pos_settings()
    key = "max_uses_cash" if entitlement_type == "Cash" else "max_uses_goods"
    return max(1, int(settings.get(key) or 1))
