"use client";

import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarInset } from "@/components/ui/sidebar";
import { useSidebarConfig } from "@/hooks/use-sidebar-config";
import { useUser } from "@/contexts/user-context";

/** Placeholder content matching the app layout's content area dimensions for use during authentication resolution. */
function SkeletonContent() {
  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 px-4 lg:px-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72" />
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
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

/**
 * Complete application frame consisting of the collapsible sidebar, top site header, and a slot for page content.
 * The sidebar placement (left/right) is determined by the user's sidebar configuration.
 */
function LayoutShell({ children }: { children: React.ReactNode }) {
  const { config } = useSidebarConfig();

  return (
    <>
      {config.side === "left" ? (
        <>
          <AppSidebar
            variant={config.variant}
            collapsible={config.collapsible}
            side={config.side}
          />
          <SidebarInset>
            <SiteHeader />
            <div className="flex flex-1 flex-col">
              <div className="@container/main flex flex-1 flex-col gap-2">
                {children}
              </div>
            </div>
          </SidebarInset>
        </>
      ) : (
        <>
          <SidebarInset>
            <SiteHeader />
            <div className="flex flex-1 flex-col">
              <div className="@container/main flex flex-1 flex-col gap-2">
                {children}
              </div>
            </div>
          </SidebarInset>
          <AppSidebar
            variant={config.variant}
            collapsible={config.collapsible}
            side={config.side}
          />
        </>
      )}
    </>
  );
}

export function AppLayout() {
  const { user, isLoading, isLoggedOut } = useUser();
  const location = useLocation();

  if (isLoggedOut) {
    const currentPath = location.pathname + location.search;
    const encodedRedirect = encodeURIComponent(currentPath);
    return <Navigate to={`/auth/sign-in?redirect-to=${encodedRedirect}`} replace />;
  }

  if (isLoading || !user) {
    return (
      <LayoutShell>
        <SkeletonContent />
      </LayoutShell>
    );
  }

  return (
    <LayoutShell>
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <Outlet />
      </div>
    </LayoutShell>
  );
}