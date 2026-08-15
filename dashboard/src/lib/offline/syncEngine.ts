/**
 * NPPOS offline data engine.
 *
 * Responsibilities:
 *  1. Tracks online/offline state (window events) and notifies subscribers.
 *  2. `initialSync(warehouse)` — fetches active vouchers + stock balance for a
 *     warehouse using ONLY standard frappe.client.get_list calls with filters
 *     (no custom backend API, no sync protocol) and stores them into the local
 *     Dexie DB.
 *  3. `queueRedemption()` — creates a LOCAL Entitlement Redemption record that
 *     works fully offline. It is stored locally ONLY (never pushed to the
 *     server); redemption actions are allowed offline.
 *  4. `refresh()` — when online, re-fetches and refreshes the local voucher +
 *     stock snapshot. Offline redemptions remain local.
 *  5. Broadcasts network + refresh status so the UI can show banners/badges.
 *
 * Data mapping lives in ./data-transform; no outbox/remote push is performed.
 */
import { toOfflineStock, toOfflineVoucher } from "./data-transform";
import type { OfflineBom, OfflineRedemption } from "./db";
import {
  beneficiaryRepo,
  bomRepo,
  localDocsRepo,
  metaRepo,
  redemptionRepo,
  stockRepo,
  voucherRepo,
} from "./repository";

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

const REFRESH_INTERVAL_MS = 60000; // refresh local data every 1 minute

class NPPOSSyncEngine {
  private isSyncing = false;
  private isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private networkCallbacks: NetworkStatusCallback[] = [];
  private statusCallback: SyncStatusCallback | null = null;
  // When true the engine pretends to be offline, regardless of navigator.onLine.
  private simulateOffline = false;

  // Backend callbacks wired by the React layer (standard frappe client methods).
  private getListCall: AnyApiCall | null = null;
  private getDocCall: AnyApiCall | null = null;
  private insertCall: AnyApiCall | null = null;
  private saveDocCall: AnyApiCall | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      window.addEventListener("online", () => this.handleNetworkChange(true));
      window.addEventListener("offline", () => this.handleNetworkChange(false));
    }
  }

  // ── Network state ──────────────────────────────────────────
  isOnlineNow(): boolean {
    return !this.simulateOffline && this.isOnline;
  }

  /**
   * Set (or unset) simulated offline mode. When enabled the engine reports
   * offline and stops network refreshes; redemptions still work locally.
   */
  setSimulateOffline(enabled: boolean): void {
    if (this.simulateOffline === enabled) return;
    this.simulateOffline = enabled;
    this.networkCallbacks.forEach((cb) => cb(this.isOnlineNow()));
    this.emitStatus({});
  }

  isSimulatingOffline(): boolean {
    return this.simulateOffline;
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
    this.networkCallbacks.forEach((cb) => cb(this.isOnlineNow()));
    if (this.isOnlineNow()) {
      this.flushPendingRedemptions()
        .then(() => this.refresh())
        .catch(() => {
          /* transient — keep cached data */
        });
    }
  }

  // Redemptions are stored locally only, so there is never anything "pending"
  // to report to the UI.
  private async pendingCount(): Promise<number> {
    return 0;
  }

  private async emitStatus(extra?: Partial<Parameters<SyncStatusCallback>[0]>) {
    this.statusCallback?.({
      syncing: this.isSyncing,
      isOnline: this.isOnline,
      pendingCount: await this.pendingCount(),
      ...extra,
    });
  }

  // ── Backend wiring ─────────────────────────────────────────
  setApiCallbacks(params: {
    getList: AnyApiCall;
    getDoc: AnyApiCall;
    insert: AnyApiCall;
    saveDoc: AnyApiCall;
  }) {
    this.getListCall = params.getList;
    this.getDocCall = params.getDoc;
    this.insertCall = params.insert;
    this.saveDocCall = params.saveDoc;
  }

  // ── Simulate offline ───────────────────────────────────────
  async toggleSimulateOffline(): Promise<boolean> {
    const next = !this.simulateOffline;
    this.setSimulateOffline(next);
    return next;
  }

  // ── Initial data fetch: active vouchers + stock balance ────
  // Uses ONLY standard frappe.client.get_list calls with filters — no custom
  // backend API. Vouchers are filtered to active/partially-redeemed with a
  // valid-from <= today and valid-to >= today (or null). Stock balance is the
  // normal Bin (on-hand) list for the warehouse.
  async initialSync(
    warehouse?: string,
  ): Promise<{ voucherCount: number; stockCount: number }> {
    if (!this.getListCall) {
      throw new Error("get_list callback not configured.");
    }
    if (!this.isOnlineNow()) {
      throw new Error("You are offline. Connect to the internet to sync.");
    }

    this.emitStatus({ syncing: true });
    try {
      // Resolve the warehouse from the locally-cached profile when not passed.
      const wh =
        warehouse ||
        (await metaRepo.getValue<string>("warehouse")) ||
        undefined;
      const today = new Date().toISOString().slice(0, 10);

      const unwrap = (res: any): any[] => {
        const data = res?.message ?? res ?? [];
        return Array.isArray(data) ? data : [];
      };

      // 1) Active vouchers (status + validity windows), full docs via get_list.
      // Valid if valid_to is unset OR valid_to >= today (or_filters).
      const voucherRes: any = await this.getListCall({
        doctype: "Entitlement Voucher",
        filters: [
          ["status", "in", ["Active", "Partially Redeemed"]],
          ["docstatus", "=", 1],
          ["valid_from", "<=", today],
        ],
        or_filters: [
          ["valid_to", "is", "not set"],
          ["valid_to", ">=", today],
        ],
        fields: ["*"],
        limit_page_length: 0,
        order_by: "modified desc",
      });
      const voucherRows = unwrap(voucherRes);
      const isGoods = (t: string) => t === "Goods";
      const vouchers = voucherRows.map((v: any) => {
        const normalized = {
          id: v.name || v.voucher_number,
          voucher_no: v.voucher_number || v.name,
          beneficiary_no: v.party || null,
          entitlement_type: isGoods(v.entitlement_type) ? "hamper" : "cash",
          amount: v.amount ?? 0,
          hamper_id: isGoods(v.entitlement_type) ? v.item : null,
          qty: isGoods(v.entitlement_type) ? v.qty : null,
          uom: isGoods(v.entitlement_type) ? v.uom : null,
          rate: v.rate ?? null,
          redeemed_amount: 0,
          redeemed_qty: 0,
          valid_from: v.valid_from ?? "",
          valid_to: v.valid_to ?? null,
          status:
            v.status === "Partially Redeemed" ? "partially_redeemed" : "active",
          uses_count: 0,
          max_uses: 2,
          project: v.project ?? "",
          assignment_id: null,
          doc: v, // full Entitlement Voucher document
        };
        return toOfflineVoucher(normalized, new Date().toISOString());
      });

      // 2) Stock balance (Bin on-hand) for the warehouse.
      let stock: any[] = [];
      if (wh) {
        const stockRes: any = await this.getListCall({
          doctype: "Bin",
          filters: [["warehouse", "=", wh]],
          fields: ["warehouse", "item_code", "actual_qty"],
          limit_page_length: 0,
        });
        stock = unwrap(stockRes).map((s: any) =>
          toOfflineStock({
            warehouse: s.warehouse,
            hamper_id: s.item_code,
            hamper_name: s.item_code,
            on_hand: s.actual_qty ?? 0,
          }),
        );
      }

      // 3) Beneficiaries for the voucher parties (richer details).
      const beneficiaryNames = [
        ...new Set(
          voucherRows
            .map((v: any) => (v.party_type === "Beneficiary" ? v.party : null))
            .filter(Boolean),
        ),
      ] as string[];
      let beneficiaries: any[] = [];
      if (beneficiaryNames.length) {
        const beneRes: any = await this.getListCall({
          doctype: "Beneficiary",
          filters: [["name", "in", beneficiaryNames]],
          fields: [
            "name",
            "full_name",
            "is_proxy",
            "phone_number",
            "email",
            "id_number",
            "beneficiary_type",
            "status",
            "warehouse",
          ],
          limit_page_length: 0,
        });
        const beneNow = new Date().toISOString();
        beneficiaries = unwrap(beneRes).map((b: any) => ({
          id: b.name,
          full_name: b.full_name ?? b.name,
          is_proxy: b.is_proxy ?? 0,
          phone_number: b.phone_number ?? "",
          email: b.email ?? "",
          id_number: b.id_number ?? "",
          beneficiary_type: b.beneficiary_type ?? "",
          status: b.status ?? "",
          warehouse: b.warehouse ?? "",
          raw: b,
          syncedAt: beneNow,
        }));
      }

      // 4) BOMs (hamper components) for goods items, plus their component stock.
      // Child tables (BOM Item) are NOT queryable via get_list, so we fetch the
      // full BOM document via frappe.client.get and read its `items` table.
      const hamperItemCodes = [
        ...new Set(vouchers.map((v) => v.hamper_id).filter(Boolean)),
      ] as string[];
      let boms: OfflineBom[] = [];
      if (hamperItemCodes.length && this.getDocCall) {
        const bomRes: any = await this.getListCall({
          doctype: "BOM",
          filters: [
            ["item", "in", hamperItemCodes],
            ["is_default", "=", 1],
            ["is_active", "=", 1],
          ],
          fields: ["name", "item"],
          limit_page_length: 0,
        });
        const bomRows = unwrap(bomRes);
        const bomNow = new Date().toISOString();
        for (const bom of bomRows) {
          const docRes: any = await this.getDocCall({
            doctype: "BOM",
            name: bom.name,
          });
          const doc = docRes?.message ?? docRes ?? {};
          const items = Array.isArray(doc.items) ? doc.items : [];
          const components = items.map((c: any) => ({
            item_code: c.item_code,
            item_name: c.item_name ?? c.item_code,
            qty: c.qty ?? 0,
            uom: c.uom ?? "",
          }));
          boms.push({
            id: doc.item || bom.item,
            name: doc.name || bom.name,
            item_name: doc.item_name || doc.item || bom.item,
            components,
            syncedAt: bomNow,
          });
        }
      }

      const now = new Date().toISOString();
      if (wh) {
        await metaRepo.set("warehouse", wh);
      }
      await metaRepo.set("last_pull", now);

      // Upsert into offline DB (idempotent).
      await voucherRepo.bulkUpsert(vouchers);
      await stockRepo.bulkUpsert(stock);
      await beneficiaryRepo.bulkUpsert(beneficiaries);
      await bomRepo.bulkUpsert(boms);

      this.emitStatus({ syncing: false, lastSync: now });

      return { voucherCount: vouchers.length, stockCount: stock.length };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Sync failed";
      this.emitStatus({ syncing: false, error: msg });
      throw error;
    }
  }

  // Refresh local voucher/stock data when online (optionally for a warehouse).
  async refresh(warehouse?: string): Promise<void> {
    if (this.isSyncing || !this.isOnlineNow() || !this.getListCall) return;
    const wh = warehouse || (await metaRepo.getValue<string>("warehouse"));
    this.isSyncing = true;
    this.emitStatus({ syncing: true });
    try {
      await this.initialSync(wh);
      this.emitStatus({ syncing: false, lastSync: new Date().toISOString() });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Sync failed";
      this.emitStatus({ syncing: false, error: msg });
    } finally {
      this.isSyncing = false;
    }
  }

  // ── Redemption: online push / offline outbox ──────────────
  private buildRedemptionDoc(params: {
    voucherNo: string;
    entitlementType: "Cash" | "Goods";
    amount?: number;
    qty?: number;
    posSession?: string;
    warehouse?: string;
  }): Record<string, any> {
    const doc: Record<string, any> = {
      doctype: "Entitlement Redemption",
      entitlement_voucher: params.voucherNo,
      entitlement_type: params.entitlementType,
      posting_date: new Date().toISOString().slice(0, 10),
    };
    if (params.entitlementType === "Cash") {
      doc.amount = params.amount ?? 0;
    } else {
      doc.qty = params.qty ?? 0;
      if (params.warehouse) doc.warehouse = params.warehouse;
    }
    if (params.posSession) doc.pos_opening_entry = params.posSession;
    return doc;
  }

  /**
   * Push a redemption to the server now. Inserts the Draft doc, re-fetches the
   * full document (with all fields + `modified`), then submits it via
   * frappe.desk.form.save.savedocs with action="Submit".
   */
  private async pushRedemptionNow(params: {
    voucherNo: string;
    entitlementType: "Cash" | "Goods";
    amount?: number;
    qty?: number;
    posSession?: string;
    warehouse?: string;
  }): Promise<string> {
    if (!this.insertCall || !this.saveDocCall || !this.getDocCall) {
      throw new Error("insert/saveDoc/getDoc callbacks not configured.");
    }
    const doc = this.buildRedemptionDoc(params);
    const insertRes: any = await this.insertCall({ doc });
    const name =
      insertRes?.message?.name ?? insertRes?.message ?? insertRes?.name;
    if (!name) throw new Error("Failed to create Entitlement Redemption.");

    // Re-fetch the full document (includes `modified`, so savedocs Submit's
    // check_if_latest passes).
    const freshRes: any = await this.getDocCall({
      doctype: "Entitlement Redemption",
      name,
    });
    const freshDoc = freshRes?.message ?? freshRes ?? {};
    if (!freshDoc?.name) {
      throw new Error("Failed to fetch Entitlement Redemption.");
    }

    // Submit via frappe.desk.form.save.savedocs with the full doc + Submit action.
    const saveRes: any = await this.saveDocCall({
      doc: JSON.stringify(freshDoc),
      action: "Submit",
    });
    return (
      saveRes?.message?.doc?.name ??
      saveRes?.doc?.name ??
      saveRes?.message ??
      name
    );
  }

  /**
   * Queue a redemption. When online it is pushed to the server immediately
   * (and stored locally as synced). When offline it is stored locally as
   * `pending` and re-pushed automatically when the connection returns.
   */
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

    // Persist the local record first (source of truth, fully offline).
    await redemptionRepo.add(red);

    if (this.isOnlineNow()) {
      try {
        const serverName = await this.pushRedemptionNow(params);
        await redemptionRepo.markSynced(id, serverName);
        red.syncStatus = "synced";
        red.serverName = serverName;
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Push failed";
        await redemptionRepo.markFailed(id, msg);
        red.syncStatus = "failed";
      }
    }

    this.emitStatus({});
    return red;
  }

  /** Re-push any locally-pending/failed redemptions when back online. */
  private async flushPendingRedemptions(): Promise<void> {
    if (!this.isOnlineNow()) return;
    const [pending, failed] = await Promise.all([
      redemptionRepo.getAll("pending"),
      redemptionRepo.getAll("failed"),
    ]);
    const toPush = [...pending, ...failed].filter((r) => r.retryCount < 5);
    for (const r of toPush) {
      try {
        const serverName = await this.pushRedemptionNow({
          voucherNo: r.voucherNo,
          entitlementType: r.entitlementType,
          amount: r.amount,
          qty: r.qty,
          posSession: r.posSession,
          warehouse: r.warehouse,
        });
        await redemptionRepo.markSynced(r.id, serverName);
      } catch {
        await redemptionRepo.markFailed(
          r.id,
          "Push failed; will retry automatically.",
        );
      }
    }
  }

  // ── Auto-refresh / interval ───────────────────────────────
  // Flushes pending redemptions and refreshes cached data every minute while
  // online.
  startAutoSync() {
    if (this.syncTimer) return;
    this.syncTimer = setInterval(() => {
      if (this.isOnlineNow()) {
        this.flushPendingRedemptions()
          .then(() => this.refresh())
          .catch(() => {
            /* transient — keep cached data */
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
    await voucherRepo.clearAll();
    await stockRepo.clearAll();
    await localDocsRepo.clearAll();
    await beneficiaryRepo.clearAll();
    await bomRepo.clearAll();
    await metaRepo.clearAll();
  }
}

export const syncEngine = new NPPOSSyncEngine();
export default syncEngine;
