/**
 * Application route configuration with lazy-loaded pages and role-protected
 * routes. The root AppLayout stays mounted across navigations so the sidebar
 * never reloads; POS pages are wrapped in POSLayout (opening-entry checks +
 * auth guards) and dynamic doctype pages are gated by OnlineOnly.
 */
import { lazy } from "react";
import { Navigate, Outlet } from "react-router-dom";

import UsersPage from "@/app/users/page";

const SignIn = lazy(() => import("@/app/auth/sign-in/page"));
const SignUp = lazy(() => import("@/app/auth/sign-up/page"));
const ForgotPassword = lazy(() => import("@/app/auth/forgot-password/page"));

const Unauthorized = lazy(() => import("@/app/errors/unauthorized/page"));
const Forbidden = lazy(() => import("@/app/errors/forbidden/page"));
const NotFound = lazy(() => import("@/app/errors/not-found/page"));
const InternalServerError = lazy(
  () => import("@/app/errors/internal-server-error/page"),
);

const Dashboard = lazy(() => import("@/app/pos/page"));
const CashVouchers = lazy(() => import("@/app/pos/cash-vouchers/page"));
const AtmCard = lazy(() => import("@/app/pos/atm-card/page"));
const TransactionHistory = lazy(() => import("@/app/pos/transactions/page"));
const RedemptionDetail = lazy(() => import("@/app/pos/transactions/[id]/page"));
const GoodsHampers = lazy(() => import("@/app/pos/goods-hampers/page"));
const SearchVoucher = lazy(() => import("@/app/pos/search/page"));
const IssueEntitlement = lazy(() => import("@/app/pos/issue-entitlement/page"));
const ClosingEntry = lazy(() => import("@/app/pos/closing-entry/page"));
const StockBalance = lazy(() => import("@/app/pos/stock-balance/page"));
const Playground = lazy(() => import("@/app/pos/playground/page"));

// Dynamic doctype pages (generic list/detail for doctypes)
const DocTypeListPage = lazy(() => import("@/app/doctype/DocTypeListPage"));
const DocTypeFormPage = lazy(() => import("@/app/doctype/DocTypeFormPage"));

const UserSettings = lazy(() => import("@/app/settings/user/page"));
const NotificationSettings = lazy(
  () => import("@/app/settings/notifications/page"),
);

import { RoleProtectedRoute } from "@/app/auth/role-protected-route";
import { AppLayout } from "@/components/layouts/app-layout";
import { POSLayout } from "@/components/layouts/pos-layout";
import OnlineOnly from "@/components/offline/OnlineOnly";

export interface RouteConfig {
  path?: string;
  element: React.ReactNode;
  children?: RouteConfig[];
  protected?: boolean;
  roles?: string[];
  index?: boolean;
  /**
   * When true, this page appears in the command-search "App Pages" results.
   * Defaults to false (opt-in): a page is only searchable when explicitly
   * marked `searchable: true`. Children must be marked too.
   */
  searchable?: boolean;
  /**
   * Human-friendly label shown in the command-search results. Falls back to a
   * slug-derived title when omitted. Never derives from the page component.
   */
  searchTitle?: string;
}

/**
 * When true, dynamic doctype browsing via /app/:doctype routes is enabled and
 * the command search surfaces "New X" / "X List" doctype results that link into
 * those routes. Toggle this off to disable that group of search results.
 */
export const APP_PAGES_ENABLED = true;

export const routes: RouteConfig[] = [
  {
    path: "/auth/sign-in",
    element: <SignIn />,
  },
  {
    path: "/auth/sign-up",
    element: <SignUp />,
  },
  {
    path: "/auth/forgot-password",
    element: <ForgotPassword />,
  },
  // Single AppLayout wraps ALL authenticated pages.
  // It stays mounted across all navigations so the sidebar never reloads.
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { path: "", element: <Navigate to="/pos" replace /> },
      {
        path: "pos",
        element: <POSLayout />,
        // Layout-only; children are the real navigable pages.
        searchable: false,
        children: [
          { path: "", element: <Navigate to="search" replace /> },
          {
            path: "goods-hampers",
            element: <GoodsHampers />,
            searchable: true,
            searchTitle: "Goods Hampers",
          },
          {
            path: "cash-vouchers",
            element: <CashVouchers />,
            searchable: true,
            searchTitle: "Cash Vouchers",
          },
          { path: "atm-card", element: <AtmCard />, searchable: true, searchTitle: "ATM Card" },
          {
            path: "transactions",
            element: <TransactionHistory />,
            searchable: true,
            searchTitle: "Transactions",
          },
          // Dynamic detail route - not a standalone searchable page.
          {
            path: "transactions/:id",
            element: <RedemptionDetail />,
            searchable: false,
          },
          {
            path: "search",
            element: <SearchVoucher />,
            searchable: true,
            searchTitle: "Search Vouchers",
          },
          {
            path: "issue-entitlement",
            element: <IssueEntitlement />,
            searchable: true,
            searchTitle: "Issue Entitlement",
          },
          {
            path: "closing-entry",
            element: <ClosingEntry />,
            searchable: true,
            searchTitle: "Closing Entry",
          },
          {
            path: "stock-balance",
            element: <StockBalance />,
            searchable: true,
            searchTitle: "Stock Balance",
          },
          {
            path: "playground",
            element: <Playground />,
            searchable: true,
            searchTitle: "Playground",
          },
        ],
      },
      // Dynamic doctype routes
      // e.g. /app/pos-closing-entry or /app/pos-closing-entry/SAL-2024-00001
      // These are surfaced as "New X" / "X List" doctype search results instead
      // of appearing directly as App Pages (their :doctype segment is dynamic).
      {
        path: "app/:doctype",
        element: (
          <OnlineOnly>
            <DocTypeListPage />
          </OnlineOnly>
        ),
        searchable: false,
      },
      {
        path: "app/:doctype/:id",
        element: (
          <OnlineOnly>
            <DocTypeFormPage />
          </OnlineOnly>
        ),
        searchable: false,
      },
      {
        path: "users",
        element: (
          <RoleProtectedRoute roles={["System Manager", "Administrator"]}>
            <UsersPage />
          </RoleProtectedRoute>
        ),
        searchable: true,
        searchTitle: "Users",
      },
      {
        path: "settings",
        element: (
          <div className="px-4 lg:px-6 space-y-6 pb-8">
            <Outlet />
          </div>
        ),
        // Layout-only; children are the real navigable pages.
        searchable: false,
        children: [
          {
            path: "",
            element: <Navigate to="user" replace />,
          },
          {
            path: "user",
            element: <UserSettings />,
            searchable: true,
            searchTitle: "User Settings",
          },
          {
            path: "notifications",
            element: <NotificationSettings />,
            searchable: true,
            searchTitle: "Notification Settings",
          },
        ],
      },
    ],
  },
  {
    path: "/errors/unauthorized",
    element: <Unauthorized />,
  },
  {
    path: "/errors/forbidden",
    element: <Forbidden />,
    searchable: false,
  },
  {
    path: "/errors/not-found",
    element: <NotFound />,
    searchable: false,
  },
  {
    path: "/errors/internal-server-error",
    element: <InternalServerError />,
    searchable: false,
  },
  {
    path: "*",
    element: <NotFound />,
    searchable: false,
  },
];
