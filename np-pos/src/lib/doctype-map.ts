/** Doctype slug mapping utility.
 *
 * Converts between URL-friendly slugs and actual Frappe doctype names.
 * This allows routes like /app/pos-closing-entry to map to "POS Closing Entry".
 */

const DOCTYPE_MAP: Record<string, string> = {
  // POS
  "pos-closing-entry": "POS Closing Entry",
  "pos-opening-entry": "POS Opening Entry",
  "pos-invoice": "POS Invoice",
  "pos-profile": "POS Profile",
  "sales-invoice": "Sales Invoice",
  "payment-entry": "Payment Entry",
  "stock-entry": "Stock Entry",
  "customer": "Customer",
  "item": "Item",
  "user": "User",
};

/** Reverse map: doctype name -> slug */
const REVERSE_MAP: Record<string, string> = {};

for (const [slug, doctype] of Object.entries(DOCTYPE_MAP)) {
  REVERSE_MAP[doctype] = slug;
}

/**
 * Convert a URL slug to a Frappe doctype name.
 * Falls back to a best-effort conversion (capitalize words, replace hyphens with spaces).
 */
export function slugToDoctype(slug: string): string {
  if (DOCTYPE_MAP[slug]) return DOCTYPE_MAP[slug];

  // Best-effort: "pos-closing-entry" -> "Pos Closing Entry"
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Convert a Frappe doctype name to a URL slug.
 * Falls back to a best-effort conversion.
 */
export function doctypeToSlug(doctype: string): string {
  if (REVERSE_MAP[doctype]) return REVERSE_MAP[doctype];

  // Best-effort: "POS Closing Entry" -> "pos-closing-entry"
  return doctype.toLowerCase().replace(/ /g, "-");
}

/**
 * Register a custom doctype mapping.
 */
export function registerDoctype(slug: string, doctype: string): void {
  DOCTYPE_MAP[slug] = doctype;
  REVERSE_MAP[doctype] = slug;
}

export default DOCTYPE_MAP;