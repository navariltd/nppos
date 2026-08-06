/**
 * OfflineProvider – wires the NPPOS sync engine to the frappe-react-sdk and
 * exposes reactive online/offline + sync status to the whole app.
 *
 * It also exposes a global API guard: `requireOnline()` that pages call before
 * hitting the network. When offline the guard throws a friendly "You are
 * offline" error and the caller shows a warning instead of fetching.
 */

"use client";

import { useFrappePostCall } from "frappe-react-sdk";
import * as React from "react";

import { syncEngine } from "@/lib/offline/syncEngine";

interface OfflineContextValue {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSync?: string;
  syncError?: string;
  /** Call nppos.sync_api.sync_pull and populate the local DB. */
  initialSync: () => Promise<{ voucherCount: number; stockCount: number }>;
  /** Queue a local offline redemption; pushes automatically when online. */
  queueRedemption: (params: {
    kind: "cash_payment" | "goods_issue";
    voucherNo: string;
    entitlementType: "Cash" | "Goods";
    amount?: number;
    qty?: number;
    posSession?: string;
    warehouse?: string;
    voucherSnapshot?: Record<string, any>;
  }) => ReturnType<typeof syncEngine.queueRedemption>;
  /** Force push pending items now (e.g. on reconnect or manual button). */
  syncNow: () => Promise<void>;
  /** Throws a friendly error if the device is offline. Call before network ops. */
  requireOnline: () => void;
  /** Reset local offline DB (e.g. logout) */
  resetOffline: () => Promise<void>;
}

const OfflineContext = React.createContext<OfflineContextValue | null>(null);

/**
 * Access the offline/sync context; throws outside an OfflineProvider.
 *
 * @returns {OfflineContextValue} reactive online/sync state and sync actions
 */
export const useOffline = () => {
  const ctx = React.useContext(OfflineContext);
  if (!ctx) throw new Error("useOffline must be used within OfflineProvider");
  return ctx;
};

/**
 * Wires the NPPOS sync engine to frappe-react-sdk and exposes reactive
 * online/offline + sync status to the whole app.
 *
 * @param children - the subtree that may use the offline context
 * @returns {JSX.Element} provider component
 */
export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = React.useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [pendingCount, setPendingCount] = React.useState(0);
  const [lastSync, setLastSync] = React.useState<string | undefined>();
  const [syncError, setSyncError] = React.useState<string | undefined>();

  // Wire the raw frappe calls to the sync engine.
  const { call: pullCall } = useFrappePostCall("nppos.sync_api.sync_pull");
  const { call: pushCall } = useFrappePostCall("nppos.sync_api.sync_push");

  React.useEffect(() => {
    syncEngine.setApiCallbacks({
      pull: (params) => pullCall(params),
      push: (params) => pushCall(params),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pullCall, pushCall]);

  // Subscribe to engine network + sync status.
  React.useEffect(() => {
    const offNetwork = syncEngine.onNetworkStatus((online) => {
      setIsOnline(online);
    });

    syncEngine.onStatusChange((status) => {
      setIsSyncing(status.syncing);
      setPendingCount(status.pendingCount);
      setLastSync(status.lastSync);
      setSyncError(status.error);
    });

    // Set initial values (in case the engine already synced).
    const init = async () => {
      setIsOnline(syncEngine.isOnlineNow());
      const initial = await syncEngine.getSyncStatus();
      setIsSyncing(initial.isSyncing);
    };
    init();

    return () => {
      offNetwork();
    };
  }, []);

  // Start background auto-sync so pending redemptions push when online.
  React.useEffect(() => {
    syncEngine.startAutoSync();
    return () => syncEngine.stopAutoSync();
  }, []);

  const value = React.useMemo<OfflineContextValue>(
    () => ({
      isOnline,
      isSyncing,
      pendingCount,
      lastSync,
      syncError,
      initialSync: syncEngine.initialSync.bind(syncEngine),
      queueRedemption: syncEngine.queueRedemption.bind(syncEngine),
      syncNow: syncEngine.autoSync.bind(syncEngine),
      requireOnline: () => {
        if (!syncEngine.isOnlineNow()) {
          const err = new Error(
            "You are offline. This action requires an internet connection.",
          ) as Error & { offline?: boolean };
          err.offline = true;
          throw err;
        }
      },
      resetOffline: syncEngine.reset.bind(syncEngine),
    }),
    [isOnline, isSyncing, pendingCount, lastSync, syncError],
  );

  return (
    <OfflineContext.Provider value={value}>{children}</OfflineContext.Provider>
  );
}

/** Returns true when the given error was raised by the offline guard. */
export function isOfflineError(err: unknown): boolean {
  return !!(err as { offline?: boolean })?.offline;
}

/**
 * Offline warning banner for pages that rely on cached data. Renders null
 * when online.
 *
 * @returns {JSX.Element | null} warning banner, or null when online
 */
export function OfflineWarning() {
  const { isOnline } = useOffline();
  if (isOnline) return null;
  return (
    <div className="bg-amber-500/15 border border-amber-500/40 text-amber-700 dark:text-amber-300 rounded-md px-4 py-3 text-sm mb-4 flex items-center gap-2">
      <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
      <span>
        You are offline. Data shown here may be from the last sync. Online-only
        actions are unavailable until you reconnect.
      </span>
    </div>
  );
}