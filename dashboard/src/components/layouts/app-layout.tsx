"use client";

import { ThemeCustomizer } from "@/components/theme-customizer";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { Skeleton } from "@/components/ui/skeleton";
import { SidebarInset } from "@/components/ui/sidebar";
import { useSidebarConfig } from "@/hooks/use-sidebar-config";
import { useThemeManager } from "@/hooks/use-theme-manager";
import { useUser } from "@/contexts/user-context";
import { PermissionGuard } from "@/app/auth/permission-guard";
import * as React from "react";

const STORAGE_KEY = "nppos:theme";

interface SavedThemeState {
  selectedTheme: string;
  selectedTweakcnTheme: string;
  selectedRadius: string;
}

function loadSavedTheme(): SavedThemeState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveThemeState(state: SavedThemeState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore
  }
}

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
function LayoutShell({ children, onOpenCustomizer }: { children: React.ReactNode; onOpenCustomizer?: () => void }) {
  const { config } = useSidebarConfig();

  return (
    <>
      {config.side === "left" ? (
        <>
          <AppSidebar
            variant={config.variant}
            collapsible={config.collapsible}
            side={config.side}
            onOpenCustomizer={onOpenCustomizer}
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
            onOpenCustomizer={onOpenCustomizer}
          />
        </>
      )}
    </>
  );
}

export function AppLayout() {
  const { user, isLoading, isLoggedOut } = useUser();
  const location = useLocation();
  const [themeCustomizerOpen, setThemeCustomizerOpen] = React.useState(false);

  // Theme persistence state
  const {
    selectedTheme,
    setSelectedTheme,
    selectedTweakcnTheme,
    setSelectedTweakcnTheme,
    selectedRadius,
    setSelectedRadius,
  } = useThemePersistence();

  // Apply saved theme on mount
  React.useEffect(() => {
    if (selectedRadius) {
      document.documentElement.style.setProperty("--radius", selectedRadius);
    }
  }, []);

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
    <>
      <LayoutShell onOpenCustomizer={() => setThemeCustomizerOpen(true)}>
        <PermissionGuard>
          <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
            <Outlet />
          </div>
        </PermissionGuard>
      </LayoutShell>
      <ThemeCustomizer
        open={themeCustomizerOpen}
        onOpenChange={setThemeCustomizerOpen}
      />
    </>
  );
}

/**
 * Hook for theme persistence via localStorage.
 * Syncs the ThemeCustomizer selections to localStorage so they persist across sessions.
 */
function useThemePersistence() {
  const [selectedTheme, setSelectedTheme] = React.useState("");
  const [selectedTweakcnTheme, setSelectedTweakcnTheme] = React.useState("");
  const [selectedRadius, setSelectedRadius] = React.useState("0.5rem");

  // Load saved state on mount
  React.useEffect(() => {
    const saved = loadSavedTheme();
    if (saved) {
      setSelectedTheme(saved.selectedTheme || "");
      setSelectedTweakcnTheme(saved.selectedTweakcnTheme || "");
      setSelectedRadius(saved.selectedRadius || "0.5rem");
    }
  }, []);

  // Save state whenever it changes
  const handleSetSelectedTheme = React.useCallback((theme: string) => {
    setSelectedTheme(theme);
    setSelectedTweakcnTheme("");
    saveThemeState({ selectedTheme: theme, selectedTweakcnTheme: "", selectedRadius: document.documentElement.style.getPropertyValue("--radius") || "0.5rem" });
  }, []);

  const handleSetSelectedTweakcnTheme = React.useCallback((theme: string) => {
    setSelectedTweakcnTheme(theme);
    setSelectedTheme("");
    saveThemeState({ selectedTheme: "", selectedTweakcnTheme: theme, selectedRadius: document.documentElement.style.getPropertyValue("--radius") || "0.5rem" });
  }, []);

  const handleSetSelectedRadius = React.useCallback((radius: string) => {
    setSelectedRadius(radius);
    // Persist radius immediately
    const current = loadSavedTheme();
    saveThemeState({ selectedTheme: current?.selectedTheme || "", selectedTweakcnTheme: current?.selectedTweakcnTheme || "", selectedRadius: radius });
  }, []);

  return {
    selectedTheme,
    setSelectedTheme: handleSetSelectedTheme,
    selectedTweakcnTheme,
    setSelectedTweakcnTheme: handleSetSelectedTweakcnTheme,
    selectedRadius,
    setSelectedRadius: handleSetSelectedRadius,
  };
}