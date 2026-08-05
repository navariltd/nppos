/**
 * NPPOS offline database (Dexie / IndexedDB).
 *
 * Stores the data the POS agent needs while offline:
 *  - vouchers     – Entitlement Vouchers for the agent's warehouse (pulled via
 *                   nppos.sync_api.sync_pull)
 *  - stockBalance – Bin levels (on-hand) for the warehouse
 *  - redemptions  – local Entitlement Redemption duplicates, tracked with a
 *                   `syncStatus` so unsynced ones can be pushed later
 *  - pending      – outbox queue for offline-created docs (redemptions,
 *                   closing entries) awaiting push via sync_push
 *  - meta         – single-row key/value store (last cursor, warehouse, profile)
 */
import Dexie, { type EntityTable } from "dexie";

/** Sync state of an offline-created document. */
export type SyncStatus = "pending" | "synced" | "failed";

/**
 * A cached Entitlement Voucher for the agent's warehouse.
 * `raw` preserves the full server document so offline pages can reconstruct
 * every field needed to create a local redemption.
 */
export interface OfflineVoucher {
  /** Entitlement Voucher doc name (== voucher_number) */
  id: string;
  voucher_no: string;
  beneficiary_no?: string | null;
  entitlement_type: "hamper" | "cash";
  amount: number;
  hamper_id?: string | null;
  qty?: number | null;
  uom?: string | null;
  rate?: number | null;
  redeemed_amount: number;
  redeemed_qty: number;
  valid_from: string;
  valid_to?: string | null;
  status: "active" | "partially_redeemed" | "redeemed" | "expired";
  uses_count: number;
  max_uses: number;
  project?: string;
  assignment_id?: string | null;
  /** Full source doc fields copied for offline redemption creation */
  raw: Record<string, any>;
  syncedAt: string;
}

/** Cached Bin level (on-hand stock) for a hamper at a warehouse. */
export interface OfflineStock {
  id: string; // `${warehouse}::${hamper_id}`
  warehouse: string;
  hamper_id: string;
  hamper_name: string;
  on_hand: number;
  syncedAt: string;
}

/** A locally-created Entitlement Redemption awaiting (or after) sync. */
export interface OfflineRedemption {
  /** Local id (`red-<uuid>`). The idempotency key sent as client_ref. */
  id: string;
  syncStatus: SyncStatus;
  kind: "cash_payment" | "goods_issue";
  voucherNo: string;
  entitlementType: "Cash" | "Goods";
  amount?: number;
  qty?: number;
  posSession?: string;
  warehouse?: string;
  createdAt: string;
  retryCount: number;
  lastError?: string;
  serverName?: string;
  /** Snapshot of the voucher used to render the redemption card offline */
  voucherSnapshot?: Record<string, any>;
}

/** An outbox entry queued for push to nppos.sync_api.sync_push. */
export interface OfflinePending {
  id: string;
  kind:
    | "cash_payment"
    | "goods_issue"
    | "pos_opening"
    | "pos_closing"
    | "stock_return"
    | "stock_damaged";
  clientRef: string;
  payload: Record<string, any>;
  createdAt: string;
  syncStatus: SyncStatus;
  retryCount: number;
  lastError?: string;
  serverName?: string;
}

/** Single-row key/value metadata (cursors, profile, warehouse). */
export interface OfflineMeta {
  key: string;
  value: any;
}

const db = new Dexie("NPPOSDB") as Dexie & {
  vouchers: EntityTable<OfflineVoucher, "id">;
  stockBalance: EntityTable<OfflineStock, "id">;
  redemptions: EntityTable<OfflineRedemption, "id">;
  pending: EntityTable<OfflinePending, "id">;
  meta: EntityTable<OfflineMeta, "key">;
};

db.version(1).stores({
  vouchers: "id, voucher_no, entitlement_type, status, beneficiary_no",
  stockBalance: "id, warehouse, hamper_id",
  redemptions: "id, syncStatus, createdAt, voucherNo",
  pending: "id, kind, syncStatus, createdAt",
  meta: "key",
});

export default db;