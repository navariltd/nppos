import json
import re

import frappe
import frappe.sessions
from frappe import _

no_cache = 1

SCRIPT_TAG_PATTERN = re.compile(r"\<script[^<]*\</script\>")
CLOSING_SCRIPT_TAG_PATTERN = re.compile(r"</script\>")


def get_context(context):
	csrf_token = frappe.sessions.get_csrf_token()
	frappe.db.commit()

	if frappe.session.user == "Guest":
		boot = frappe.website.utils.get_boot_data()
	else:
		try:
			boot = frappe.sessions.get()
		except Exception as e:
			raise frappe.SessionBootFailed from e

	boot["push_relay_server_url"] = frappe.conf.get("push_relay_server_url")

	if "server_script_enabled" in frappe.conf:
		enabled = frappe.conf.server_script_enabled
	else:
		enabled = True
	boot["server_script_enabled"] = enabled

	boot_json = frappe.as_json(boot, indent=None, separators=(",", ":"))
	boot_json = SCRIPT_TAG_PATTERN.sub("", boot_json)
	boot_json = CLOSING_SCRIPT_TAG_PATTERN.sub("", boot_json)
	boot_json = json.dumps(boot_json)

	app_name = frappe.get_website_settings("app_name") or frappe.get_system_settings("app_name")
	if app_name and app_name != "Frappe":
		app_title = app_name + " | " + "NPPOS"
	else:
		app_title = "NPPOS"

	icon_url = "/assets/nppos/logo.png"

	context.update(
		{
			"build_version": frappe.utils.get_build_version(),
			"boot": boot_json,
			"csrf_token": csrf_token,
			"app_name": app_title,
			"icon_96": icon_url,
			"apple_touch_icon": icon_url,
			"mask_icon": icon_url,
			"favicon_svg": icon_url,
			"favicon_ico": icon_url,
			"sitename": boot.get("sitename") or frappe.local.site,
			"preload_links": "",
		}
	)

	return context


@frappe.whitelist(methods=["POST"], allow_guest=True)
def get_context_for_dev():
	if not frappe.conf.developer_mode:
		frappe.throw(_("This method is only meant for developer mode"))
	return json.loads(get_boot())


def get_boot():
	try:
		boot = frappe.sessions.get()
	except Exception as e:
		raise frappe.SessionBootFailed from e

	boot["push_relay_server_url"] = frappe.conf.get("push_relay_server_url")
	boot_json = frappe.as_json(boot, indent=None, separators=(",", ":"))
	boot_json = SCRIPT_TAG_PATTERN.sub("", boot_json)
	boot_json = CLOSING_SCRIPT_TAG_PATTERN.sub("", boot_json)
	boot_json = json.dumps(boot_json)

	return boot_json
