import frappe
from frappe.utils import flt


def validate(doc, method):
	if doc.docstatus != 0:
		return

	if doc.get("enable_entitlement_distribution"):
		autofill_entitlement_redemptions(doc)


def autofill_entitlement_redemptions(doc):
	"""Autofill entitlement_redemptions child table from submitted Entitlement
	Redemption records linked to the same POS Opening Entry, then update the
	closing entry totals (total_quantity, net_total, grand_total)."""

	if not doc.pos_opening_entry:
		return

	redemptions = frappe.db.get_all(
		"Entitlement Redemption",
		filters={
			"pos_opening_entry": doc.pos_opening_entry,
			"docstatus": 1,
		},
		fields=[
			"name",
			"posting_date",
			"party_type",
			"party",
			"item",
			"qty",
			"amount",
		],
		order_by="posting_date asc, creation asc",
	)

	doc.set("entitlement_redemptions", [])

	total_quantity = 0.0
	net_total = 0.0

	for redemption in redemptions:
		qty = flt(redemption.get("qty"))
		amount = flt(redemption.get("amount"))

		total_quantity += qty
		net_total += amount

		doc.append(
			"entitlement_redemptions",
			{
				"entitlement_redemption": redemption.get("name"),
				"posting_date": redemption.get("posting_date"),
				"party_type": redemption.get("party_type"),
				"party": redemption.get("party"),
				"item": redemption.get("item"),
				"qty": qty,
				"grand_total": amount,
			},
		)

	doc.total_quantity = total_quantity
	doc.net_total = net_total
	doc.grand_total = net_total
