# Copyright (c) 2026, Navari Limited and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class EntitlementVoucher(Document):
	def before_save(self):
		self.generate_qr_code()

	def on_submit(self):
		self.generate_qr_code()

	def on_update_after_submit(self):
		self.generate_qr_code()

	def generate_qr_code(self):
		"""Auto-generate QR code image and save to the image field."""
		if not self.voucher_number or not self.name or self.image:
			return

		try:
			from io import BytesIO

			import qrcode

			qr = qrcode.QRCode(version=1, box_size=10, border=4)
			qr.add_data(self.voucher_number)
			qr.make(fit=True)
			img = qr.make_image(fill_color="black", back_color="white")

			buffer = BytesIO()
			img.save(buffer, format="PNG")
			buffer.seek(0)

			file_name = f"{self.voucher_number}-qr.png".replace("/", "-").replace(" ", "_")

			if self.image:
				try:
					old_file = frappe.get_doc(
						"File",
						{
							"file_url": self.image,
							"attached_to_doctype": self.doctype,
							"attached_to_name": self.name,
						},
					)
					old_file.delete(ignore_permissions=True)
				except frappe.DoesNotExistError:
					pass
				except Exception:
					pass

			_file = frappe.get_doc(
				{
					"doctype": "File",
					"file_name": file_name,
					"is_private": 0,
					"content": buffer.getvalue(),
					"attached_to_doctype": self.doctype,
					"attached_to_name": self.name,
				}
			)
			_file.insert(ignore_permissions=True)

			self.db_set("image", _file.file_url, commit=False)

		except ImportError:
			pass
		except Exception:
			frappe.log_error(
				title="Entitlement Voucher QR Generation",
				message=f"Failed to generate QR code for {self.name}",
			)
