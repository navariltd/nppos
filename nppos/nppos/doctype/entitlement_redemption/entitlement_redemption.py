# Copyright (c) 2026, Navari Limited and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class EntitlementRedemption(Document):
	def validate(self):
		if not self.posting_date:
			self.posting_date = frappe.utils.nowdate()

	def on_submit(self):
		if self.entitlement_type == "Cash":
			self.create_payment_entry()
		elif self.entitlement_type == "Goods":
			self.create_stock_entry()

	def get_common_fields(self, target_doctype):
		common_fields = {}
		target_meta = frappe.get_meta(target_doctype)
		target_fields = [field.fieldname for field in target_meta.fields]

		for field in self.meta.fields:
			fieldname = field.fieldname
			if fieldname in target_fields and hasattr(self, fieldname):
				value = getattr(self, fieldname)
				if value is not None and value != "":
					common_fields[fieldname] = value

		return common_fields

	def create_payment_entry(self):
		if not self.party:
			frappe.throw("Party is required for Payment Entry")
		if not self.amount:
			frappe.throw("Amount is required for Payment Entry")
		if not self.company:
			frappe.throw("Company is required for Payment Entry")
		if not self.posting_date:
			frappe.throw("Posting Date is required for Payment Entry")
		if not self.paid_from:
			frappe.throw("Account Paid From is required for Payment Entry")
		if not self.paid_to:
			frappe.throw("Account Paid To is required for Payment Entry")

		mode_of_payment = "Cash"
		if self.pos_profile:
			pos_profile = frappe.get_doc("POS Profile", self.pos_profile)
			if pos_profile.payments:
				for payment in pos_profile.payments:
					if payment.default == 1:
						mode_of_payment = payment.mode_of_payment
						break

		party_type = self.party_type or "Customer"

		common_fields = self.get_common_fields("Payment Entry")

		payment_entry = frappe.new_doc("Payment Entry")

		for fieldname, value in common_fields.items():
			setattr(payment_entry, fieldname, value)

		payment_entry.update(
			{
				"payment_type": "Pay",
				"mode_of_payment": mode_of_payment,
				"party_type": party_type,
				"party": self.party,
				"paid_amount": self.amount,
				"received_amount": self.amount,
				"paid_from": self.paid_from,
				"paid_to": self.paid_to,
				"reference_no": self.name,
				"reference_date": self.posting_date,
				"entitlement_redemption": self.name,
				"remarks": f"Entitlement Redemption: {self.entitlement_voucher} - {self.description or ''}",
			}
		)

		if self.bank_account:
			payment_entry.bank_account = self.bank_account

		if self.party_bank_account:
			payment_entry.party_bank_account = self.party_bank_account

		payment_entry.insert()
		payment_entry.submit()

		frappe.msgprint(f"Payment Entry {payment_entry.name} created successfully")
		return payment_entry

	def create_stock_entry(self):
		if not self.item:
			frappe.throw("Item is required for Stock Entry")
		if not self.qty:
			frappe.throw("Quantity is required for Stock Entry")
		if not self.warehouse:
			frappe.throw("Warehouse is required for Stock Entry")
		if not self.company:
			frappe.throw("Company is required for Stock Entry")
		if not self.posting_date:
			frappe.throw("Posting Date is required for Stock Entry")

		common_fields = self.get_common_fields("Stock Entry")

		stock_entry = frappe.new_doc("Stock Entry")

		for fieldname, value in common_fields.items():
			setattr(stock_entry, fieldname, value)

		stock_entry.update(
			{
				"stock_entry_type": "Material Issue",
				"entitlement_redemption": self.name,
				"remarks": f"Entitlement Redemption: {self.entitlement_voucher} - {self.description or ''}",
			}
		)

		stock_entry.append(
			"items",
			{
				"item_code": self.item,
				"qty": self.qty,
				"uom": self.uom,
				"stock_uom": self.uom,
				"basic_rate": self.rate,
				"basic_amount": self.amount or (self.rate * self.qty),
				"amount": self.amount or (self.rate * self.qty),
				"s_warehouse": self.warehouse,
				"cost_center": self.cost_center,
				"project": self.project,
				"conversion_factor": 1,
				"allow_zero_valuation_rate": 1,
			},
		)

		stock_entry.insert()
		stock_entry.submit()

		frappe.msgprint(f"Stock Entry {stock_entry.name} created successfully")

		return stock_entry
