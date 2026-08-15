"use client";

/** Application sidebar with navigation groups for authenticated and unauthenticated users. */

import * as React from "react";
import { Link } from "react-router-dom";

import { Boxes, CheckSquare, History, LayoutDashboard, LogIn } from "lucide-react";

import { Logo } from "@/components/logo";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@/contexts/user-context";

const privateNavGroups = [
  {
    items: [
      {
        title: "Search Voucher",
        url: "/pos",
        icon: LayoutDashboard,
      },
      {
        title: "Redemptions",
        url: "/pos/transactions",
        icon: History,
      },
      {
        title: "Stock Balance",
        url: "/pos/stock-balance",
        icon: Boxes,
      },
      {
        title: "Closing Entry",
        url: "/pos/closing-entry",
        icon: CheckSquare,
      },
    ],
  },
];

function SidebarSkeleton() {
  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" disabled>
              <Skeleton className="size-8 rounded-lg" />
              <div className="grid flex-1 text-left text-sm leading-tight gap-1">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-3 w-28" />
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {[1, 2, 3].map((section) => (
          <div key={section} className="px-3 py-2">
            <Skeleton className="h-4 w-24 mb-3" />
            <div className="space-y-1">
              {[1, 2, 3].map((item) => (
                <Skeleton key={item} className="h-8 w-full rounded-md" />
              ))}
            </div>
          </div>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <div className="p-2 flex items-center gap-2">
          <Skeleton className="size-8 rounded-full" />
          <div className="grid flex-1 gap-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppSidebar({ onOpenCustomizer, ...props }: React.ComponentProps<typeof Sidebar> & { onOpenCustomizer?: () => void }) {
  const { user, isLoading, error } = useUser();

  if (isLoading) {
    return <SidebarSkeleton />;
  }

  if (error) {
    console.error("Error fetching user data:", error);
  }

  const isAuthenticated = !!user;

  return (
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to={isAuthenticated ? "/pos" : "/auth/sign-in"}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Logo size={24} className="text-current" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">NP POS</span>
                  <span className="truncate text-xs">
                    {isAuthenticated ? "NP Point of Sale" : "Welcome"}
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {isAuthenticated ? (
          <>
            {privateNavGroups.map((group) => (
              <NavMain
                key={group.label}
                label={group.label}
                items={group.items}
              />
            ))}
          </>
        ) : (
          <></>
        )}
      </SidebarContent>
      <SidebarFooter>
        {isAuthenticated ? (
          <NavUser user={user} onOpenCustomizer={onOpenCustomizer} />
        ) : (
          <div className="p-2">
            <Link
              to="/auth/sign-in"
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all hover:bg-accent hover:text-accent-foreground"
            >
              <LogIn className="h-4 w-4" />
              <span>Sign In</span>
            </Link>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
