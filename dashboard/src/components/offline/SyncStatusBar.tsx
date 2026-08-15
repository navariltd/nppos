import { RefreshCw, Wifi } from "lucide-react";

import { useOffline } from "@/contexts/offline-context";

/**
 * Global data-refresh indicator rendered above page content.
 * Shows a slim refresh status only while syncing online. Offline state is
 * surfaced via a small warning in the site header (see SiteHeader).
 *
 * @returns {JSX.Element | null} refresh status bar, or null when idle
 */
export default function SyncStatusBar() {
  const { isOnline, isSyncing, syncNow } = useOffline();

  if (!isOnline || !isSyncing) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-b border-emerald-500/20">
      <Wifi className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1 truncate">Refreshing data…</span>
      <button
        onClick={() => syncNow()}
        disabled={isSyncing}
        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-emerald-500/10 disabled:opacity-50"
      >
        <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin" : ""}`} />
        Refresh
      </button>
    </div>
  );
}