/**
 * NPPOS offline database (Dexie / IndexedDB).
 *
 * Stores the data the POS agent needs while offline:
 *  - vouchers     – Entitlement Vouchers for the agent's warehouse (fetched via
 *                   a standard frappe.client.get_list query)
 *  - stockBalance – Bin levels (on-hand) for the warehouse
 *  - redemptions  – local Entitlement Redemption records (stored locally only;
 *                   never pushed to the server)
 *  - localDocs    – locally-stored documents (e.g. POS Closing Entries)
 *  - pending      – legacy outbox queue (retained for backward compat)
 *  - meta         – single-row key/value store (last refresh, warehouse, profile)
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
  /** Local id (`red-<uuid>`). */
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

/** A locally-stored document (e.g. POS Opening/Closing Entry) kept for offline records. */
export interface OfflineLocalDoc {
  id: string;
  kind: "pos_closing" | "pos_opening";
  data: Record<string, any>;
  createdAt: string;
}

/** A cached Beneficiary doc for richer voucher party details. */
export interface OfflineBeneficiary {
  id: string; // Beneficiary name (BENE-...)
  full_name: string;
  is_proxy?: number;
  phone_number?: string;
  email?: string;
  id_number?: string;
  beneficiary_type?: string;
  status?: string;
  warehouse?: string;
  raw: Record<string, any>;
  syncedAt: string;
}

/** A BOM component (one line of a hamper's Bill of Materials). */
export interface OfflineBomComponent {
  item_code: string;
  item_name: string;
  qty: number;
  uom: string;
}

/** A cached BOM (hamper) keyed by the hamper item code, with components + stock. */
export interface OfflineBom {
  id: string; // hamper item_code
  name?: string; // default BOM name
  item_name?: string;
  components: OfflineBomComponent[];
  syncedAt: string;
}

/** A legacy outbox entry (retained for backward compatibility). */
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
  localDocs: EntityTable<OfflineLocalDoc, "id">;
  beneficiaries: EntityTable<OfflineBeneficiary, "id">;
  boms: EntityTable<OfflineBom, "id">;
  meta: EntityTable<OfflineMeta, "key">;
};

db.version(1).stores({
  vouchers: "id, voucher_no, entitlement_type, status, beneficiary_no",
  stockBalance: "id, warehouse, hamper_id",
  redemptions: "id, syncStatus, createdAt, voucherNo",
  pending: "id, kind, syncStatus, createdAt",
  localDocs: "id, kind, createdAt",
  beneficiaries: "id, full_name, phone_number, email",
  boms: "id, name",
  meta: "key",
});

export default db;