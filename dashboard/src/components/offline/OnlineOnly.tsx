import { WifiOff } from "lucide-react";

import { useOffline } from "@/contexts/offline-context";

/**
 * Wraps pages that REQUIRE an active internet connection (e.g. /app dynamic
 * doctype pages, ATM card, cash vouchers, goods hampers). When offline, these
 * render an offline warning and do NOT fetch anything — the child content is
 * not mounted so no network calls fire.
 *
 * @param children - the online-only page content
 * @returns {JSX.Element} children when online, or an offline warning
 */
export default function OnlineOnly({ children }: { children: React.ReactNode }) {
  const { isOnline } = useOffline();

  if (isOnline) {
    return <>{children}</>;
  }

  return (
    <div className="px-4 lg:px-6 py-10">
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="h-14 w-14 rounded-full bg-amber-500/15 flex items-center justify-center mb-4">
          <WifiOff className="h-7 w-7 text-amber-500" />
        </div>
        <h2 className="text-xl font-semibold mb-2">You are offline</h2>
        <p className="text-muted-foreground max-w-md mb-6">
          This page requires an internet connection and is not available while
          offline. Please reconnect to continue.
        </p>
      </div>
    </div>
  );
}