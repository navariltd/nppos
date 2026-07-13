import { AppRouter } from "@/components/router/app-router";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SidebarConfigProvider } from "@/contexts/sidebar-context";
import { UserProvider } from "@/contexts/user-context";
import { FrappeProvider } from "frappe-react-sdk";
import { BrowserRouter as Router } from "react-router-dom";

const basename = "np-pos";

/**
 * Read sidebar state from cookie on mount so collapsed/expanded state
 * survives full page navigations and component remounts.
 */
function getInitialSidebarOpen(): boolean {
  if (typeof document === "undefined") return false;
  const match = document.cookie.match(/(?:^|;\s*)sidebar_state=([^;]*)/);
  return match ? match[1] === "true" : false;
}

function App() {
  return (
    <div
      className="font-sans antialiased"
      style={{ fontFamily: "var(--font-inter)" }}
    >
      <FrappeProvider enableSocket={false}>
        <UserProvider>
          <ThemeProvider defaultTheme="system" storageKey="np-pos-theme">
            <SidebarConfigProvider>
              <Router basename={basename}>
                {/* SidebarProvider lives above the router so its state never
                    resets when navigating between page groups (POS → Settings → Users).
                    The actual <Sidebar> component only renders on POS pages via POSLayout. */}
                <SidebarProvider defaultOpen={getInitialSidebarOpen()}>
                  <AppRouter />
                </SidebarProvider>
              </Router>
            </SidebarConfigProvider>
          </ThemeProvider>
        </UserProvider>
      </FrappeProvider>
    </div>
  );
}

export default App;
