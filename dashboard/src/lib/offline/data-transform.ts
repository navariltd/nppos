/**
 * Pure mapping helpers that convert server payloads from nppos.sync_api into
 * the local Dexie table shapes (OfflineVoucher, OfflineStock).
 *
 * Kept free of side effects and DB access so the mapping is trivially testable.
 */
import type { OfflineStock, OfflineVoucher } from "./db";

/**
 * Normalise a voucher row from `sync_pull` into an OfflineVoucher.
 *
 * `raw` preserves the ENTIRE voucher document (including the embedded `doc`)
 * so offline pages can reconstruct every field for local redemptions.
 *
 * @param v - raw voucher row from the sync payload
 * @param now - timestamp to stamp on the row (defaults to now)
 * @returns {OfflineVoucher} the normalised row
 */
export function toOfflineVoucher(
  v: Record<string, any>,
  now = new Date().toISOString(),
): OfflineVoucher {
  return {
    id: v.id,
    voucher_no: v.voucher_no,
    beneficiary_no: v.beneficiary_no,
    entitlement_type: v.entitlement_type,
    amount: v.amount ?? 0,
    hamper_id: v.hamper_id,
    qty: v.qty ?? null,
    uom: v.uom ?? null,
    rate: v.rate ?? null,
    redeemed_amount: v.redeemed_amount ?? 0,
    redeemed_qty: v.redeemed_qty ?? 0,
    valid_from: v.valid_from ?? "",
    valid_to: v.valid_to ?? null,
    status: v.status ?? "active",
    uses_count: v.uses_count ?? 0,
    max_uses: v.max_uses ?? 2,
    project: v.project ?? "",
    assignment_id: v.assignment_id ?? null,
    raw: v.doc || v, // full Entitlement Voucher document when available
    syncedAt: now,
  };
}

/**
 * Normalise a stock row from `sync_pull` into an OfflineStock.
 *
 * @param s - raw agent_stock row from the sync payload
 * @returns {OfflineStock} the normalised row
 */
export function toOfflineStock(s: Record<string, any>): OfflineStock {
  return {
    id: `${s.warehouse}::${s.hamper_id}`,
    warehouse: s.warehouse,
    hamper_id: s.hamper_id,
    hamper_name: s.hamper_name,
    on_hand: s.on_hand ?? 0,
    syncedAt: new Date().toISOString(),
  };
}

/** A concise, human-readable summary of a voucher for debug/sync logs. */
export function voucherSummary(v: OfflineVoucher): Record<string, unknown> {
  return {
    id: v.id,
    voucher_no: v.voucher_no,
    entitlement_type: v.entitlement_type,
    status: v.status,
    amount: v.amount,
    qty: v.qty,
    valid_from: v.valid_from,
    valid_to: v.valid_to,
  };
}