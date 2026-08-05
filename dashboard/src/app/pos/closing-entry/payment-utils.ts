/**
 * Pure helpers for POS closing-entry payment reconciliation: building the
 * initial payment rows from an opening entry, merging transaction payments in,
 * and aggregating invoice totals. Kept side-effect free for easy testing.
 */
import type { Invoice, PaymentRow, TotalsData } from "./types";

/**
 * Build the initial payment rows from the opening entry's balance details.
 *
 * @param balanceDetails - opening-entry cash/mode-of-payment rows
 * @returns {PaymentRow[]} initial payment reconciliation rows at the float
 */
export function initPaymentsFromBalance(
  balanceDetails: Array<{ mode_of_payment: string; opening_amount: number }>,
): PaymentRow[] {
  return balanceDetails.map((bd, idx) => ({
    idx: idx + 1,
    mode_of_payment: bd.mode_of_payment,
    opening_amount: bd.opening_amount,
    expected_amount: bd.opening_amount,
    closing_amount: bd.opening_amount,
    difference: 0,
  }));
}

/**
 * Merge transaction payment rows into the initial opening-float rows.
 *
 * @param initPayments - rows seeded from the opening entry's balance
 * @param dataPayments - transaction payment rows from the invoice fetch
 * @returns {PaymentRow[]} merged reconciliation rows
 */
export function mergePayments(
  initPayments: PaymentRow[],
  dataPayments: Array<{ mode_of_payment: string; amount: number }>,
): PaymentRow[] {
  const paymentMap = new Map<string, PaymentRow>();
  for (const ip of initPayments) paymentMap.set(ip.mode_of_payment, ip);
  for (const p of dataPayments) {
    const existing = paymentMap.get(p.mode_of_payment);
    if (existing) {
      existing.expected_amount += p.amount;
      existing.closing_amount = existing.expected_amount;
      existing.difference = 0;
    } else {
      paymentMap.set(p.mode_of_payment, {
        idx: paymentMap.size + 1,
        mode_of_payment: p.mode_of_payment,
        opening_amount: 0,
        expected_amount: p.amount,
        closing_amount: p.amount,
        difference: 0,
      });
    }
  }
  return Array.from(paymentMap.values());
}

/**
 * Aggregate invoice totals into the display summary.
 *
 * @param invoices - invoices to sum
 * @returns {TotalsData} the aggregated totals
 */
export function sumTotals(invoices: Invoice[]): TotalsData {
  let gt = 0;
  let nt = 0;
  let tq = 0;
  let tt = 0;
  for (const inv of invoices) {
    gt += inv.grand_total ?? 0;
    nt += inv.net_total ?? 0;
    tq += inv.total_qty ?? 0;
    tt += inv.total_taxes_and_charges ?? 0;
  }
  return { grand_total: gt, net_total: nt, total_quantity: tq, total_taxes: tt };
}