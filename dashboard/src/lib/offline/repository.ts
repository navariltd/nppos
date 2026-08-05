/**
 * Repositories for the NPPOS offline database — the data access layer the
 * offline-first POS pages use instead of hitting the network.
 *
 * Provides typed CRUD helpers per collection (vouchers, stock, redemptions,
 * pending outbox, meta) plus database maintenance operations.
 */
import db, {
  type OfflineMeta,
  type OfflinePending,
  type OfflineRedemption,
  type OfflineStock,
  type OfflineVoucher,
  type SyncStatus,
} from "./db";

const nowIso = () => new Date().toISOString();

/**
 * Cached voucher data access.
 */
export const voucherRepo = {
  /** Idempotently insert or update a batch of vouchers. */
  async bulkUpsert(vouchers: OfflineVoucher[]): Promise<void> {
    if (vouchers.length === 0) return;
    await db.vouchers.bulkPut(vouchers);
  },

  /** Fetch a voucher by its document name (== voucher number). */
  async getById(id: string): Promise<OfflineVoucher | undefined> {
    return db.vouchers.get(id);
  },

  /** Fetch a voucher by its voucher number. */
  async getByNo(voucherNo: string): Promise<OfflineVoucher | undefined> {
    return db.vouchers.where("voucher_no").equals(voucherNo).first();
  },

  /** Search vouchers by voucher number or beneficiary (case-insensitive). */
  async search(term: string): Promise<OfflineVoucher[]> {
    const all = await db.vouchers.toArray();
    const q = term.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (v) =>
        v.voucher_no.toLowerCase().includes(q) ||
        (v.beneficiary_no ?? "").toLowerCase().includes(q),
    );
  },

  /** Vouchers not yet fully redeemed or expired. */
  async active(): Promise<OfflineVoucher[]> {
    const all = await db.vouchers.toArray();
    return all.filter((v) => v.status !== "redeemed" && v.status !== "expired");
  },

  /** Remove all cached vouchers. */
  async clearAll(): Promise<void> {
    await db.vouchers.clear();
  },
};

/**
 * Cached stock balance (Bin levels) data access.
 */
export const stockRepo = {
  /** Idempotently insert or update a batch of stock rows. */
  async bulkUpsert(rows: OfflineStock[]): Promise<void> {
    if (rows.length === 0) return;
    await db.stockBalance.bulkPut(rows);
  },

  /** Fetch all stock rows, optionally filtered by warehouse. */
  async getAll(warehouse?: string): Promise<OfflineStock[]> {
    if (warehouse) {
      return db.stockBalance.where("warehouse").equals(warehouse).toArray();
    }
    return db.stockBalance.toArray();
  },

  /** Remove all cached stock rows. */
  async clearAll(): Promise<void> {
    await db.stockBalance.clear();
  },
};

/**
 * Local redemption records data access.
 */
export const redemptionRepo = {
  /** Fetch redemptions, optionally filtered by sync status (newest first). */
  async getAll(status?: SyncStatus): Promise<OfflineRedemption[]> {
    if (status) {
      return db.redemptions
        .where("syncStatus")
        .equals(status)
        .reverse()
        .sortBy("createdAt");
    }
    const all = await db.redemptions.toArray();
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  /** Fetch a redemption by local id. */
  async getById(id: string): Promise<OfflineRedemption | undefined> {
    return db.redemptions.get(id);
  },

  /** Insert a local redemption record. */
  async add(red: OfflineRedemption): Promise<void> {
    await db.redemptions.put(red);
  },

  /** Mark a redemption as synced with its server doc name. */
  async markSynced(id: string, serverName: string): Promise<void> {
    await db.redemptions.update(id, { syncStatus: "synced", serverName });
  },

  /** Mark a redemption as failed, incrementing its retry count. */
  async markFailed(id: string, error: string): Promise<void> {
    const entry = await db.redemptions.get(id);
    if (entry) {
      await db.redemptions.update(id, {
        syncStatus: "failed",
        retryCount: entry.retryCount + 1,
        lastError: error,
      });
    }
  },

  /** Re-queue a redemption for another sync attempt. */
  async markPending(id: string): Promise<void> {
    await db.redemptions.update(id, { syncStatus: "pending" });
  },

  /** Remove all local redemption records. */
  async clearAll(): Promise<void> {
    await db.redemptions.clear();
  },
};

/**
 * Pending outbox queue data access (docs awaiting push via sync_push).
 */
export const pendingRepo = {
  /** Fetch outbox entries, optionally filtered by sync status. */
  async getAll(status?: SyncStatus): Promise<OfflinePending[]> {
    if (status) {
      return db.pending.where("syncStatus").equals(status).toArray();
    }
    return db.pending.toArray();
  },

  /**
   * Queue a new outbox entry with a generated id and pending status.
   *
   * @param entry - outbox record without the auto-managed fields
   * @returns {Promise<string>} the generated entry id
   */
  async enqueue(
    entry: Omit<
      OfflinePending,
      "id" | "createdAt" | "syncStatus" | "retryCount"
    >,
  ): Promise<string> {
    const id = `pend_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    await db.pending.put({
      id,
      ...entry,
      createdAt: nowIso(),
      syncStatus: "pending" as SyncStatus,
      retryCount: 0,
    });
    return id;
  },

  /** Mark an outbox entry as synced with its server doc name. */
  async markSynced(id: string, serverName: string): Promise<void> {
    await db.pending.update(id, { syncStatus: "synced", serverName });
  },

  /** Mark an outbox entry as failed, incrementing its retry count. */
  async markFailed(id: string, error: string): Promise<void> {
    const entry = await db.pending.get(id);
    if (entry) {
      await db.pending.update(id, {
        syncStatus: "failed",
        retryCount: entry.retryCount + 1,
        lastError: error,
      });
    }
  },

  /** Delete an outbox entry. */
  async delete(id: string): Promise<void> {
    await db.pending.delete(id);
  },

  /** Remove all outbox entries. */
  async clearAll(): Promise<void> {
    await db.pending.clear();
  },
};

/**
 * Key/value metadata store (cursors, profile, warehouse).
 */
export const metaRepo = {
  /** Fetch a raw metadata row by key. */
  async get(key: string): Promise<OfflineMeta | undefined> {
    return db.meta.get(key);
  },

  /** Fetch a metadata value by key. */
  async getValue<T = any>(key: string): Promise<T | undefined> {
    const row = await db.meta.get(key);
    return row?.value as T | undefined;
  },

  /** Set a metadata value for a key. */
  async set(key: string, value: any): Promise<void> {
    await db.meta.put({ key, value });
  },

  /** Remove a metadata key. */
  async remove(key: string): Promise<void> {
    await db.meta.delete(key);
  },

  /** Remove all metadata. */
  async clearAll(): Promise<void> {
    await db.meta.clear();
  },
};

/**
 * Database maintenance utilities.
 */
export const offlineDBMaintenance = {
  /** Wipe all offline collections (e.g. on logout). */
  async clearAllData(): Promise<void> {
    await Promise.all([
      db.vouchers.clear(),
      db.stockBalance.clear(),
      db.redemptions.clear(),
      db.pending.clear(),
      db.meta.clear(),
    ]);
  },

  /** Approximate IndexedDB storage usage, or null when unsupported. */
  async getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage ?? 0,
        quota: estimate.quota ?? 0,
      };
    }
    return null;
  },
};