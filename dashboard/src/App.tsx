import { AppRouter } from "@/components/router/app-router";
import { ThemeProvider } from "@/components/theme-provider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { NotificationProvider } from "@/contexts/notification-context";
import { SidebarConfigProvider } from "@/contexts/sidebar-context";
import { UserProvider } from "@/contexts/user-context";
import { FrappeProvider } from "frappe-react-sdk";
import { BrowserRouter as Router } from "react-router-dom";

const basename = "nppos";

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
      <FrappeProvider
        enableSocket={false}
        swrConfig={{ revalidateOnFocus: false, revalidateOnReconnect: false }}
      >
        <UserProvider>
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
        </UserProvider>
      </FrappeProvider>
    </div>
  );
}

export default App;
