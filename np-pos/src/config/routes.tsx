import UsersPage from "@/app/users/page";
import { lazy } from "react";
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

const UserSettings = lazy(() => import("@/app/settings/user/page"));
const AccountSettings = lazy(() => import("@/app/settings/account/page"));
const NotificationSettings = lazy(
  () => import("@/app/settings/notifications/page"),
);

import { ProtectedRoute } from "@/app/auth/protected-route";
import { RoleProtectedRoute } from "@/app/auth/role-protected-route";

export interface RouteConfig {
  path: string;
  element: React.ReactNode;
  children?: RouteConfig[];
  protected?: boolean;
  roles?: string[];
}

export const routes: RouteConfig[] = [
  {
    path: "/",
    element: <Navigate to="/pos" replace />,
  },
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
  {
    path: "/pos",
    element: (
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: "/pos/goods-hampers",
    element: (
      <ProtectedRoute>
        <GoodsHampers />
      </ProtectedRoute>
    ),
  },
  {
    path: "/pos/cash-vouchers",
    element: (
      <ProtectedRoute>
        <CashVouchers />
      </ProtectedRoute>
    ),
  },
  {
    path: "/pos/atm-card",
    element: (
      <ProtectedRoute>
        <AtmCard />
      </ProtectedRoute>
    ),
  },
  {
    path: "/pos/transactions",
    element: (
      <ProtectedRoute>
        <TransactionHistory />
      </ProtectedRoute>
    ),
  },
  {
    path: "/users",
    element: (
      <RoleProtectedRoute roles={["System Manager", "Administrator"]}>
        <UsersPage />
      </RoleProtectedRoute>
    ),
  },
  {
    path: "/settings/user",
    element: (
      <ProtectedRoute>
        <UserSettings />
      </ProtectedRoute>
    ),
  },
  {
    path: "/settings/account",
    element: (
      <ProtectedRoute>
        <AccountSettings />
      </ProtectedRoute>
    ),
  },
  {
    path: "/settings/notifications",
    element: (
      <ProtectedRoute>
        <NotificationSettings />
      </ProtectedRoute>
    ),
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
