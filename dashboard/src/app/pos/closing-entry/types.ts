/** Type definitions for POS Closing Entry feature. */

export interface PaymentRow {
  idx: number;
  mode_of_payment: string;
  opening_amount: number;
  expected_amount: number;
  closing_amount: number;
  difference: number;
}

/** A single Entitlement Redemption row in the closing entry (matches the
 * `Entitlement Redemption Reference` child-table shape used on the backend). */
export interface RedemptionRow {
  entitlement_redemption: string;
  posting_date: string;
  party_type: string;
  party: string;
  item: string;
  qty: number;
  grand_total: number;
}

export interface TotalsData {
  grand_total: number;
  net_total: number;
  total_quantity: number;
  total_taxes: number;
}
