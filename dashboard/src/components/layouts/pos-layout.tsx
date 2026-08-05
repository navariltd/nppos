"use client";

/**
 * POS layout that wraps POS pages with opening entry checks and
 * authentication guards. Runs the initial offline pull once an opening entry
 * exists so the local voucher/stock snapshot stays fresh.
 */
import * as React from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";

import { POSOpeningModal } from "@/app/pos/components/POSOpeningModal";
import SyncStatusBar from "@/components/offline/SyncStatusBar";
import { Skeleton } from "@/components/ui/skeleton";
import { useOffline } from "@/contexts/offline-context";
import { POSProvider, usePOS } from "@/contexts/pos-context";
import { useUser } from "@/contexts/user-context";

/**
 * Renders skeleton placeholders matching POS page content structure during
 * metadata or authentication loading.
 *
 * @returns {JSX.Element} skeleton screen
 */
function ContentSkeleton() {
  return (
    <div className="px-4 lg:px-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <Skeleton className="h-[400px] w-full rounded-lg" />
        </div>
        <div className="lg:col-span-2 space-y-4">
          <Skeleton className="h-[500px] w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

function POSLayoutContent() {
  const { user, isLoading, isLoggedOut } = useUser();
  const { posOpeningEntry, isLoadingMetadata, refreshPOSMetadata } = usePOS();
  const { initialSync, requireOnline } = useOffline();
  const location = useLocation();
  const navigate = useNavigate();

  // Run the initial offline pull (vouchers + stock balance) once an opening
  // entry exists. Runs on EVERY page reload/mount and whenever the opening
  // entry changes, so the local voucher/stock snapshot is always fresh.
  React.useEffect(() => {
    const hasOpening = posOpeningEntry && Array.isArray(posOpeningEntry)
      ? posOpeningEntry.length > 0
      : !!posOpeningEntry;
    if (hasOpening && !isLoadingMetadata) {
      try {
        requireOnline();
        initialSync().catch(() => {
          // Swallow — user can be offline; they'll use last-cached data.
        });
      } catch {
        // Offline — skip pull; local cache is used.
      }
    }
  }, [posOpeningEntry, isLoadingMetadata]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoadingMetadata && !posOpeningEntry) {
    return <ContentSkeleton />;
  }

  if (isLoggedOut) {
    const currentPath = location.pathname + location.search;
    const encodedRedirect = encodeURIComponent(currentPath);
    return (
      <Navigate to={`/auth/sign-in?redirect-to=${encodedRedirect}`} replace />
    );
  }

  if (isLoading || !user) {
    return <ContentSkeleton />;
  }

  const needsOpeningEntry =
    !posOpeningEntry ||
    (Array.isArray(posOpeningEntry) && posOpeningEntry.length === 0);

  if (needsOpeningEntry) {
    return (
      <div className="relative w-full">
        <div className="pointer-events-none select-none blur-[2px]">
          <div className="flex w-full">
            <Outlet />
          </div>
        </div>
        <POSOpeningModal onSuccess={() => {
          refreshPOSMetadata();
          navigate("/pos", { replace: true });
        }} />
      </div>
    );
  }

  return (
    <>
      <SyncStatusBar />
      <Outlet />
    </>
  );
}

export function POSLayout() {
  return (
    <POSProvider>
      <POSLayoutContent />
    </POSProvider>
  );
}
