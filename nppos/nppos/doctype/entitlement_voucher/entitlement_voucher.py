# Copyright (c) 2026, Navari Limited and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class EntitlementVoucher(Document):
	def before_save(self):
		self.generate_qr_code()

	def on_submit(self):
		self.generate_qr_code()

	def generate_qr_code(self):
		"""Auto-generate QR code image and save to the image field if not already set."""
		if self.image:
			return

		if not self.voucher_number:
			return

		try:
			import qrcode
			from io import BytesIO

			# Build the data payload for the QR code
			qr_data = (
				f"Voucher: {self.voucher_number}\n"
				f"Type: {self.entitlement_type}\n"
				f"Party: {self.party or 'N/A'}\n"
				f"Amount: {self.amount or 0}\n"
				f"Qty: {self.qty or 0}\n"
				f"Valid: {self.valid_from or ''} - {self.valid_to or ''}"
			)

			qr = qrcode.QRCode(version=1, box_size=10, border=4)
			qr.add_data(qr_data)
			qr.make(fit=True)
			img = qr.make_image(fill_color="black", back_color="white")

			buffer = BytesIO()
			img.save(buffer, format="PNG")
			buffer.seek(0)

			# Attach the QR code image to the document's image field
			file_name = f"{self.voucher_number}-qr.png".replace("/", "-").replace(" ", "_")
			_file = frappe.get_doc({
				"doctype": "File",
				"file_name": file_name,
				"is_private": 0,
				"content": buffer.getvalue(),
				"attached_to_doctype": self.doctype,
				"attached_to_name": self.name,
			})
			_file.insert(ignore_permissions=True)

			self.db_set("image", _file.file_url, commit=False)

		except ImportError:
			# qrcode library not installed, silently skip
			pass
		except Exception:
			frappe.log_error(
				title="Entitlement Voucher QR Generation",
				message=f"Failed to generate QR code for {self.name}",
			)