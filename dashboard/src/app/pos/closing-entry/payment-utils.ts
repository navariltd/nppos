/**
 * Pure helpers for POS closing-entry payment reconciliation: building the
 * initial payment rows from an opening entry. Kept side-effect free for easy testing.
 */
import type { PaymentRow } from "./types";

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