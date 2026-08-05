import { RefreshCw, Wifi, WifiOff } from "lucide-react";

import { useOffline } from "@/contexts/offline-context";

/**
 * Global connectivity/sync indicator rendered above page content.
 * Shows offline warning, pending-sync count, and a manual sync button.
 *
 * @returns {JSX.Element | null} status bar, or null when online with nothing pending
 */
export default function SyncStatusBar() {
  const { isOnline, isSyncing, pendingCount, lastSync, syncNow } = useOffline();

  if (isOnline && pendingCount === 0 && !isSyncing) {
    return null;
  }

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 text-xs ${
        isOnline
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-b border-emerald-500/20"
          : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-b border-amber-500/30"
      }`}
    >
      {isOnline ? (
        <Wifi className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <WifiOff className="h-3.5 w-3.5 shrink-0 animate-pulse" />
      )}
      <span className="flex-1 truncate">
        {isOnline
          ? isSyncing
            ? "Syncing…"
            : pendingCount > 0
              ? `${pendingCount} pending item${pendingCount > 1 ? "s" : ""} — will sync when online`
              : "Online"
          : "You are offline — working from last synced data"}
      </span>
      {pendingCount > 0 && isOnline && (
        <button
          onClick={() => syncNow()}
          disabled={isSyncing}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-emerald-500/10 disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
          Sync
        </button>
      )}
      {lastSync && (
        <span className="hidden sm:inline text-muted-foreground/60">
          Last sync: {new Date(lastSync).toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}