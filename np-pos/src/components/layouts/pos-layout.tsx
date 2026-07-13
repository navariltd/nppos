"use client";

import { POSProvider, usePOS } from "@/contexts/pos-context";
import { useUser } from "@/contexts/user-context";
import { Navigate, Outlet } from "react-router-dom";
import { POSOpeningModal } from "@/app/pos/components/POSOpeningModal";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * POS-specific layout that adds POSProvider and opening-entry checking.
 * The sidebar and site header are handled by the parent AppLayout which
 * stays mounted across all authenticated page navigations.
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
  const { user } = useUser();
  const { posOpeningEntry, isLoadingMetadata, refreshPOSMetadata } = usePOS();

  // Show page skeleton while metadata loads on first visit
  if (isLoadingMetadata && !posOpeningEntry) {
    return <ContentSkeleton />;
  }

  if (!user) {
    return <Navigate to="/auth/sign-in" replace />;
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
        <POSOpeningModal onSuccess={refreshPOSMetadata} />
      </div>
    );
  }

  return <Outlet />;
}

export function POSLayout() {
  return (
    <POSProvider>
      <POSLayoutContent />
    </POSProvider>
  );
}