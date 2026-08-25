"use client";

import { WifiOff } from "lucide-react";

import { CommandSearch, SearchTrigger } from "@/components/command-search";
import { ModeToggle } from "@/components/mode-toggle";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { useOffline } from "@/contexts/offline-context";
import { useUser } from "@/contexts/user-context";
import { POS_PROFILE_CACHE_KEY, POS_PROFILE_CHANGED_EVENT } from "@/lib/pos-session";
import * as React from "react";

export function SiteHeader() {
  const { isLoading } = useUser();
  const { isOnline } = useOffline();
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);
  const [posProfile, setPosProfile] = React.useState<{
    name?: string;
    warehouse?: string;
  } | null>(null);

  // Read the open POS profile from the shared cache (kept in sync by the POS
  // context via a custom window event) so the badge shows the active session.
  React.useEffect(() => {
    const readProfile = () => {
      try {
        const cached = sessionStorage.getItem(POS_PROFILE_CACHE_KEY);
        setPosProfile(cached ? JSON.parse(cached) : null);
      } catch {
        setPosProfile(null);
      }
    };
    readProfile();
    window.addEventListener(POS_PROFILE_CHANGED_EVENT, readProfile);
    return () =>
      window.removeEventListener(POS_PROFILE_CHANGED_EVENT, readProfile);
  }, []);

  return (
    <>
      <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
        <div className="flex w-full items-center gap-1 px-4 py-3 lg:gap-2 lg:px-6">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mx-2 data-[orientation=vertical]:h-4"
          />
          {isLoading ? (
            <div className="flex-1 max-w-sm">
              <Skeleton className="h-9 w-full rounded-md" />
            </div>
          ) : (
            <div className="flex-1 max-w-sm">
              <SearchTrigger onClick={() => setSearchOpen((prev) => !prev)} />
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            {posProfile?.name && (
              <span
                title={
                  posProfile.warehouse
                    ? `${posProfile.name} · ${posProfile.warehouse}`
                    : posProfile.name
                }
                className="inline-flex max-w-[180px] items-center gap-1.5 rounded-full border bg-muted px-2.5 py-1 text-xs font-medium text-foreground"
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" />
                <span className="truncate">{posProfile.name}</span>
              </span>
            )}
            {!isOnline && (
              <span
                className="relative inline-flex items-center justify-center rounded-md border-2 p-1.5 cursor-default"
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
              >
                <WifiOff className="h-[1.2rem] w-[1.2rem]" />
                {hovered && (
                  <span
                    role="tooltip"
                    className="absolute top-full right-0 mt-2 z-50 w-56 rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md"
                  >
                    You are offline. Redemptions can still be recorded and will
                    be stored locally.
                  </span>
                )}
              </span>
            )}
            <ModeToggle />
          </div>
        </div>
      </header>
      <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
