/**
 * App – root component that composes the application providers and router.
 *
 * Lays out the provider hierarchy (Frappe SDK, user, offline, notification,
 * theme, sidebar) and mounts the application router under the `/nppos` base.
 */
import { AppRouter } from "@/components/router/app-router";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { NotificationProvider } from "@/contexts/notification-context";
import { OfflineProvider } from "@/contexts/offline-context";
import { SidebarConfigProvider } from "@/contexts/sidebar-context";
import { UserProvider } from "@/contexts/user-context";
import { FrappeProvider } from "frappe-react-sdk";
import { BrowserRouter as Router } from "react-router-dom";

const basename = "nppos";

/**
 * Read the persisted sidebar open-state from the `sidebar_state` cookie.
 *
 * @returns {boolean} whether the sidebar should start open
 */
function getInitialSidebarOpen(): boolean {
  if (typeof document === "undefined") return false;
  const match = document.cookie.match(/(?:^|;\s*)sidebar_state=([^;]*)/);
  return match ? match[1] === "true" : false;
}

/**
 * Root component wrapping all providers and the router.
 *
 * @returns {JSX.Element} the fully composed application
 */
function App() {
  return (
    <div
      className="font-sans antialiased"
      style={{ fontFamily: "var(--font-inter)" }}
    >
      <FrappeProvider
        enableSocket={false}
        swrConfig={{ revalidateOnFocus: false, revalidateOnReconnect: false }}
      >
        <UserProvider>
          <OfflineProvider>
            <NotificationProvider>
              <ThemeProvider defaultTheme="system" storageKey="np-pos-theme">
                <SidebarConfigProvider>
                  <Router basename={basename}>
                    <SidebarProvider defaultOpen={getInitialSidebarOpen()}>
                      <AppRouter />
                    </SidebarProvider>
                  </Router>
                </SidebarConfigProvider>
              </ThemeProvider>
            </NotificationProvider>
          </OfflineProvider>
        </UserProvider>
      </FrappeProvider>
    </div>
  );
}

export default App;