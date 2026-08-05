"""Schema customisations installed for the NPPOS offline sync flow.

Idempotently creates the sync-tracking fields on Entitlement Redemption — the
voucher flow's primary business document: ``client_ref`` (unique idempotency
key carried by every pushed redemption) and ``sync_status`` (push state
tracker). No sync-tracking fields are installed on Stock Entry, POS Opening
Entry or POS Closing Entry.
"""

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_fields


def _client_ref_field(insert_after):
    """Field definition for the unique idempotency key column."""
    return {
        "fieldname": "client_ref",
        "label": "Client Ref",
        "fieldtype": "Data",
        "insert_after": insert_after,
        "unique": 1,
        "read_only": 1,
        "no_copy": 1,
        "print_hide": 1,
        "description": "NPPOS client id — idempotency key for offline sync.",
    }


def _sync_status_field(insert_after):
    """Field definition for the offline push state tracker."""
    return {
        "fieldname": "sync_status",
        "label": "Sync Status",
        "fieldtype": "Select",
        "insert_after": insert_after,
        "options": "\nPending\nSynced\nFailed",
        "read_only": 1,
        "no_copy": 1,
        "print_hide": 1,
        "in_list_view": 1,
        "description": "Offline push state for Entitlement Redemptions created from the offline-first web/mobile app.",
    }


def after_migrate():
    """Idempotent: create_custom_fields skips fields that already exist."""
    create_custom_fields(
        {
            "Entitlement Redemption": [
                _client_ref_field("amended_from"),
                _sync_status_field("client_ref"),
            ]
        },
        ignore_validate=True,
    )