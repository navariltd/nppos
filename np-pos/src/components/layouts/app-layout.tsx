"use client";

import { Navigate, Outlet } from "react-router-dom";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset } from "@/components/ui/sidebar";
import { useSidebarConfig } from "@/hooks/use-sidebar-config";
import { useUser } from "@/contexts/user-context";

/**
 * Persistent app layout that wraps all authenticated pages with the sidebar
 * and site header. Stays mounted across ALL navigations (POS <-> Users <-> Settings)
 * so the sidebar never remounts or reloads.
 *
 * If the user is not logged in, redirects to sign-in.
 */
export function AppLayout() {
  const { user } = useUser();
  const { config } = useSidebarConfig();

  if (!user) {
    return <Navigate to="/auth/sign-in" replace />;
  }

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
                <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                  <Outlet />
                </div>
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
                <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                  <Outlet />
                </div>
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