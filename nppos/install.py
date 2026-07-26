import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields


# The mobile app's client UUID travels with every push and is the idempotency key
_CLIENT_REF_DOCTYPES = (
    "Entitlement Redemption",
    "Stock Entry",
    "POS Opening Entry",
    "POS Closing Entry",
)


def _client_ref_field(insert_after):
    return {
        "fieldname": "custom_client_ref",
        "label": "Client Ref",
        "fieldtype": "Data",
        "insert_after": insert_after,
        "unique": 1,
        "read_only": 1,
        "no_copy": 1,
        "print_hide": 1,
        "description": "NPPOS mobile client UUID — idempotency key for offline sync.",
    }


def after_migrate():
    """Idempotent: create_custom_fields skips fields that already exist."""
    create_custom_fields(
        {dt: [_client_ref_field("amended_from")] for dt in _CLIENT_REF_DOCTYPES},
        ignore_validate=True,
    )
