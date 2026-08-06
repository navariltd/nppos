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

import { AppLayout } from "@/components/layouts/app-layout";
import { POSLayout } from "@/components/layouts/pos-layout";
import OnlineOnly from "@/components/offline/OnlineOnly";
import { RoleProtectedRoute } from "@/app/auth/role-protected-route";

export interface RouteConfig {
  path?: string;
  element: React.ReactNode;
  children?: RouteConfig[];
  protected?: boolean;
  roles?: string[];
  index?: boolean;
}

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
        children: [
          { path: "", element: <Navigate to="search" replace /> },
          { path: "goods-hampers", element: <GoodsHampers /> },
          { path: "cash-vouchers", element: <CashVouchers /> },
          { path: "atm-card", element: <AtmCard /> },
          { path: "transactions", element: <TransactionHistory /> },
          { path: "search", element: <SearchVoucher /> },
          { path: "issue-entitlement", element: <IssueEntitlement /> },
          { path: "closing-entry", element: <ClosingEntry /> },
          { path: "stock-balance", element: <StockBalance /> },
          { path: "playground", element: <Playground /> },
        ],
      },
      // Dynamic doctype routes
      // e.g. /app/pos-closing-entry or /app/pos-closing-entry/SAL-2024-00001
      {
        path: "app/:doctype",
        element: (
          <OnlineOnly>
            <DocTypeListPage />
          </OnlineOnly>
        ),
      },
      {
        path: "app/:doctype/:id",
        element: (
          <OnlineOnly>
            <DocTypeFormPage />
          </OnlineOnly>
        ),
      },
      {
        path: "users",
        element: (
          <RoleProtectedRoute roles={["System Manager", "Administrator"]}>
            <UsersPage />
          </RoleProtectedRoute>
        ),
      },
      {
        path: "settings",
        element: <div className="px-4 lg:px-6 space-y-6 pb-8"><Outlet /></div>,
        children: [
          {
            path: "",
            element: <Navigate to="user" replace />,
          },
          {
            path: "user",
            element: <UserSettings />,
          },
          {
            path: "notifications",
            element: <NotificationSettings />,
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
  },
  {
    path: "/errors/not-found",
    element: <NotFound />,
  },
  {
    path: "/errors/internal-server-error",
    element: <InternalServerError />,
  },
  {
    path: "*",
    element: <NotFound />,
  },
];