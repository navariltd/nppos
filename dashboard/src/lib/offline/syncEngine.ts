/**
 * NPPOS offline sync engine.
 *
 * Responsibilities:
 *  1. Tracks online/offline state (window events) and notifies subscribers.
 *  2. `initialSync()` — calls nppos.sync_api.sync_pull and stores vouchers +
 *     stock balance into the local Dexie DB.
 *  3. `queueRedemption()` — creates a LOCAL Entitlement Redemption duplicate
 *     (with a generated client_ref idempotency key) that works fully offline.
 *  4. `autoSync()` — when online, pushes pending redemptions/closing entries via
 *     nppos.sync_api.sync_push and marks them synced/failed.
 *  5. Broadcasts sync + network status so the UI can show banners/badges.
 *
 * Data mapping and outbox push logic live in ./data-transform and
 * ./outbox-pusher; this class owns lifecycle + state only.
 */
import { toOfflineStock, toOfflineVoucher } from "./data-transform";
import { flushOutbox } from "./outbox-pusher";
import {
  metaRepo,
  pendingRepo,
  redemptionRepo,
  stockRepo,
  voucherRepo,
} from "./repository";
import type { OfflineRedemption } from "./db";

export type NetworkStatusCallback = (online: boolean) => void;
export type SyncStatusCallback = (status: {
  syncing: boolean;
  isOnline: boolean;
  pendingCount: number;
  lastSync?: string;
  error?: string;
}) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyApiCall = (params: Record<string, any>) => Promise<any>;

const REFRESH_INTERVAL_MS = 60000; // refresh local data + push pending every 1 minute

class NPPOSSyncEngine {
  private isSyncing = false;
  private isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private networkCallbacks: NetworkStatusCallback[] = [];
  private statusCallback: SyncStatusCallback | null = null;

  // Backend callbacks wired by the React layer.
  private pullCall: AnyApiCall | null = null;
  private pushCall: AnyApiCall | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.handleNetworkChange(true));
      window.addEventListener("offline", () => this.handleNetworkChange(false));
    }
  }

  // ── Network state ──────────────────────────────────────────
  isOnlineNow(): boolean {
    return this.isOnline;
  }

  onNetworkStatus(cb: NetworkStatusCallback): () => void {
    this.networkCallbacks.push(cb);
    return () => {
      this.networkCallbacks = this.networkCallbacks.filter((c) => c !== cb);
    };
  }

  onStatusChange(cb: SyncStatusCallback) {
    this.statusCallback = cb;
  }

  private handleNetworkChange(online: boolean) {
    this.isOnline = online;
    this.networkCallbacks.forEach((cb) => cb(online));
    if (online) {
      this.autoSync();
    }
  }

  // Count only items still awaiting sync (pending + failed) — synced ones are
  // excluded so the UI never shows "N pending" for already-uploaded rows.
  private async pendingCount(): Promise<number> {
    const pending = await pendingRepo.getAll("pending");
    const failed = await pendingRepo.getAll("failed");
    return pending.length + failed.length;
  }

  private async emitStatus(
    extra?: Partial<Parameters<SyncStatusCallback>[0]>,
  ) {
    this.statusCallback?.({
      syncing: this.isSyncing,
      isOnline: this.isOnline,
      pendingCount: await this.pendingCount(),
      ...extra,
    });
  }

  // ── Backend wiring ─────────────────────────────────────────
  setApiCallbacks(params: { pull: AnyApiCall; push: AnyApiCall }) {
    this.pullCall = params.pull;
    this.pushCall = params.push;
  }

  // ── Initial sync: pull vouchers + stock balance ───────────
  async initialSync(): Promise<{ voucherCount: number; stockCount: number }> {
    if (!this.pullCall) {
      throw new Error("Sync engine pull callback not configured.");
    }
    if (!this.isOnline) {
      throw new Error("You are offline. Connect to the internet to sync.");
    }

    this.emitStatus({ syncing: true });
    try {
      const res: any = await this.pullCall({});
      const data = res?.message ?? res ?? {};

      const now = new Date().toISOString();
      const vouchers = Array.isArray(data.vouchers)
        ? data.vouchers.map((v: any) => toOfflineVoucher(v, now))
        : [];
      const stock = Array.isArray(data.agent_stock)
        ? data.agent_stock.map((s: any) => toOfflineStock(s))
        : [];

      // Cache pos profiles + cursors for future delta syncs, and the pull time.
      if (data.pos_profiles) {
        await metaRepo.set("pos_profiles", data.pos_profiles);
      }
      if (data.cursors) {
        await metaRepo.set("cursors", data.cursors);
      }
      await metaRepo.set("last_pull", now);

      // Upsert into offline DB (idempotent).
      await voucherRepo.bulkUpsert(vouchers);
      await stockRepo.bulkUpsert(stock);

      this.emitStatus({ syncing: false, lastSync: now });

      return { voucherCount: vouchers.length, stockCount: stock.length };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Sync failed";
      this.emitStatus({ syncing: false, error: msg });
      throw error;
    }
  }

  // ── Local offline redemption (queue + store) ──────────────
  async queueRedemption(params: {
    kind: "cash_payment" | "goods_issue";
    voucherNo: string;
    entitlementType: "Cash" | "Goods";
    amount?: number;
    qty?: number;
    posSession?: string;
    warehouse?: string;
    voucherSnapshot?: Record<string, any>;
  }): Promise<OfflineRedemption> {
    const id = `red_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const red: OfflineRedemption = {
      id,
      syncStatus: "pending",
      kind: params.kind,
      voucherNo: params.voucherNo,
      entitlementType: params.entitlementType,
      amount: params.amount,
      qty: params.qty,
      posSession: params.posSession,
      warehouse: params.warehouse,
      voucherSnapshot: params.voucherSnapshot,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };

    // Persist the local redemption record (works fully offline).
    await redemptionRepo.add(red);

    // Also enqueue an idempotent outbox entry for push when online.
    await pendingRepo.enqueue({
      kind: params.kind,
      clientRef: id, // idempotency key == local redemption id
      payload: {
        kind: params.kind,
        voucherNo: params.voucherNo,
        ...(params.amount !== undefined ? { amount: params.amount } : {}),
        ...(params.qty !== undefined ? { qty: params.qty } : {}),
        ...(params.posSession ? { posSession: params.posSession } : {}),
        ...(params.warehouse ? { warehouse: params.warehouse } : {}),
      },
    });

    // Push immediately when online — no waiting for the next interval.
    if (this.isOnline) {
      await this.autoSync().catch(() => {
        // If the immediate push fails, it stays queued and retries via autoSync.
      });
    }

    this.emitStatus({});
    return red;
  }

  // ── Auto-sync pending items ───────────────────────────────
  async autoSync(): Promise<void> {
    if (this.isSyncing || !this.isOnline || !this.pushCall) return;

    this.isSyncing = true;
    this.emitStatus({ syncing: true });

    try {
      await flushOutbox(this.pushCall);
      this.emitStatus({ syncing: false, lastSync: new Date().toISOString() });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Sync failed";
      this.emitStatus({ syncing: false, error: msg });
    } finally {
      this.isSyncing = false;
    }
  }

  // ── Auto-refresh / interval ───────────────────────────────
  // Pushes pending redemptions/closings AND refreshes the local voucher +
  // stock snapshot every minute (60s) while online.
  startAutoSync() {
    if (this.syncTimer) return;
    this.syncTimer = setInterval(() => {
      if (this.isOnline) {
        this.autoSync().then(() => {
          // Refresh the local data (full docs) every minute if online.
          this.initialSync().catch(() => {
            /* offline/transient — keep cached data */
          });
        });
      }
    }, REFRESH_INTERVAL_MS);
  }

  stopAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
  }

  getSyncStatus(): { isSyncing: boolean; isOnline: boolean } {
    return { isSyncing: this.isSyncing, isOnline: this.isOnline };
  }

  // ── Reset (on logout) ──────────────────────────────────────
  async reset() {
    this.stopAutoSync();
    await redemptionRepo.clearAll();
    await pendingRepo.clearAll();
    await voucherRepo.clearAll();
    await stockRepo.clearAll();
    await metaRepo.clearAll();
  }
}

export const syncEngine = new NPPOSSyncEngine();
export default syncEngine;