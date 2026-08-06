/**
 * Pure helpers for the voucher search page: currency formatting, document
 * status badge/label mapping, and offline-row → display-shape conversion.
 */

/** Format a number as Kenyan Shillings, or an em-dash when null/undefined. */
export function fmt(val: number | null | undefined): string {
  if (val == null) return "—";
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 0,
  }).format(val);
}

/** Badge variant for a docstatus/status value. */
export function dsVariant(
  ds: string | number,
): "default" | "secondary" | "outline" | "destructive" {
  if (ds === "redeemed" || ds === 2) return "outline";
  if (ds === "expired") return "destructive";
  if (ds === "active" || ds === "partially_redeemed" || ds === 1)
    return "default";
  return "secondary";
}

/** Human-readable label for a docstatus/status value. */
export function dsLabel(ds: string | number): string {
  if (ds === "active" || ds === 1) return "Active";
  if (ds === "partially_redeemed") return "Partially Redeemed";
  if (ds === "redeemed" || ds === 2) return "Redeemed";
  if (ds === "expired") return "Expired";
  if (ds === 0) return "Draft";
  return "Unknown";
}

/** Convert an offline voucher row into the display shape the page expects. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fromOffline(row: any): any {
  const raw = row.raw || {};
  return {
    ...raw,
    name: row.id,
    voucher_number: row.voucher_no || row.id,
    party: row.beneficiary_no ?? raw.party,
    entitlement_type: row.entitlement_type === "cash" ? "Cash" : "Goods",
    amount: row.amount,
    qty: row.qty,
    item: row.hamper_id,
    uom: row.uom,
    rate: row.rate,
    valid_from: row.valid_from,
    valid_to: row.valid_to,
    status: row.status,
    docstatus:
      row.status === "active" || row.status === "partially_redeemed" ? 1 : 0,
  };
}