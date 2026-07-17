/** Application route configuration with lazy-loaded pages and role-protected routes. */

import { lazy } from "react";

import UsersPage from "@/app/users/page";
import { Navigate } from "react-router-dom";

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
const ClosingEntry = lazy(() => import("@/app/pos/closing-entry/page"));
const Playground = lazy(() => import("@/app/pos/playground/page"));

// Dynamic doctype pages (generic list/detail for doctypes)
const DocTypeListPage = lazy(() => import("@/app/doctype/DocTypeListPage"));
const DocTypeFormPage = lazy(() => import("@/app/doctype/DocTypeFormPage"));

const UserSettings = lazy(() => import("@/app/settings/user/page"));
const AccountSettings = lazy(() => import("@/app/settings/account/page"));
const NotificationSettings = lazy(
  () => import("@/app/settings/notifications/page"),
);

import { AppLayout } from "@/components/layouts/app-layout";
import { POSLayout } from "@/components/layouts/pos-layout";
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
          { path: "", element: <Dashboard /> },
          { path: "goods-hampers", element: <GoodsHampers /> },
          { path: "cash-vouchers", element: <CashVouchers /> },
          { path: "atm-card", element: <AtmCard /> },
          { path: "transactions", element: <TransactionHistory /> },
          { path: "closing-entry", element: <ClosingEntry /> },
          { path: "playground", element: <Playground /> },
        ],
      },
      // Dynamic doctype routes
      // e.g. /app/pos-closing-entry or /app/pos-closing-entry/SAL-2024-00001
      {
        path: "app/:doctype",
        element: <DocTypeListPage />,
      },
      {
        path: "app/:doctype/:id",
        element: <DocTypeFormPage />,
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
        element: <AppLayout />,
        children: [
          {
            path: "user",
            element: <UserSettings />,
          },
          {
            path: "account",
            element: <AccountSettings />,
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