/** Type definitions for POS Closing Entry feature. */

export interface Invoice {
  name: string;
  customer: string;
  posting_date: string;
  grand_total: number;
  net_total: number;
  total_qty: number;
  total_taxes_and_charges: number;
  change_amount: number;
  account_for_change_amount: string;
  is_return: 0 | 1;
  return_against: string;
  timestamp: string;
  doctype: "POS Invoice" | "Sales Invoice";
}

export interface PaymentSummary {
  mode_of_payment: string;
  account: string;
  amount: number;
}

export interface TaxSummary {
  account_head: string;
  tax_amount: number;
}

export interface GetInvoicesResponse {
  invoices: Invoice[];
  payments: PaymentSummary[];
  taxes: TaxSummary[];
}

export interface PaymentRow {
  idx: number;
  mode_of_payment: string;
  opening_amount: number;
  expected_amount: number;
  closing_amount: number;
  difference: number;
}

export interface TotalsData {
  grand_total: number;
  net_total: number;
  total_quantity: number;
  total_taxes: number;
}