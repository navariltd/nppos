/**
 * POSDashboard – main landing page after login with quick navigation and daily summary.
 *
 * Key dependencies: uses POS context for session defaults and opening entry data,
 * and Frappe service for fetching daily redemption summaries.
 */

"use client";

import { useNavigate } from "react-router-dom";
import { useFrappeGetCall } from "frappe-react-sdk";
import { Gift, CreditCard, Banknote, Search, List, Receipt, Loader2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePOS } from "@/contexts/pos-context";
import { useUser } from "@/contexts/user-context";

interface QuickActionCard {
  title: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  color: string;
}

const quickActions: QuickActionCard[] = [
  {
    title: "Goods / Hampers",
    description: "Issue physical goods to beneficiaries",
    icon: <Gift className="h-8 w-8" />,
    path: "/pos/goods-hampers",
    color: "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20",
  },
  {
    title: "Cash Vouchers",
    description: "Process cash withdrawal vouchers",
    icon: <Banknote className="h-8 w-8" />,
    path: "/pos/cash-vouchers",
    color: "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20",
  },
  {
    title: "ATM Card",
    description: "Handle card-based withdrawals",
    icon: <CreditCard className="h-8 w-8" />,
    path: "/pos/atm-card",
    color: "bg-purple-500/10 text-purple-600 hover:bg-purple-500/20",
  },
  {
    title: "Search Voucher",
    description: "Find voucher by number, beneficiary, or entitlement",
    icon: <Search className="h-8 w-8" />,
    path: "/pos/search",
    color: "bg-orange-500/10 text-orange-600 hover:bg-orange-500/20",
  },
  {
    title: "Transactions",
    description: "View redemption history and records",
    icon: <List className="h-8 w-8" />,
    path: "/pos/transactions",
    color: "bg-sky-500/10 text-sky-600 hover:bg-sky-500/20",
  },
];

/** Format a number as KES currency. */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", minimumFractionDigits: 0 }).format(amount);
}

export default function POSDashboard() {
  const navigate = useNavigate();
  const { user } = useUser();
  const { sessionDefaults, posOpeningEntry, isLoadingMetadata } = usePOS();

  // Fetch today's summary counts
  const { data: todaySummary, isLoading: summaryLoading } = useFrappeGetCall(
    "frappe.desk.reportview.get_count",
    {
      doctype: "Entitlement Redemption",
      filters: JSON.stringify([
        ["Entitlement Redemption", "docstatus", "=", "1"],
        ["Entitlement Redemption", "creation", ">=", new Date().toISOString().slice(0, 10)],
      ]),
      fields: JSON.stringify([]),
      distinct: false,
    },
    `pos-dash-summary-${new Date().toISOString().slice(0, 10)}`,
  );

  const todayCount = todaySummary?.message || 0;
  const posProfile = sessionDefaults?.[0]?.pos_profile_name || "—";
  const company = sessionDefaults?.[0]?.company || "—";
  const cashierName = user?.full_name || user?.name || "—";
  const today = new Date().toLocaleDateString("en-KE", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const isOpen = Array.isArray(posOpeningEntry) ? posOpeningEntry.length > 0 : !!posOpeningEntry;

  return (
    <div className="px-4 lg:px-6 space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">POS Dashboard</h1>
        <p className="text-muted-foreground">Welcome, {cashierName}</p>
      </div>

      {/* POS Info Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cashier</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingMetadata ? <Skeleton className="h-5 w-32" /> : <p className="text-lg font-semibold">{cashierName}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">POS Profile</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingMetadata ? <Skeleton className="h-5 w-24" /> : <p className="text-lg font-semibold">{posProfile}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Company / Branch</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingMetadata ? <Skeleton className="h-5 w-28" /> : <p className="text-lg font-semibold">{company}</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            {isLoadingMetadata ? (
              <Skeleton className="h-5 w-20" />
            ) : (
              <>
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${isOpen ? "bg-green-500" : "bg-amber-500"}`} />
                <p className="text-lg font-semibold">{isOpen ? "Open" : "Closed"}</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Date & Summary Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{today}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Today's Redemptions</p>
              {summaryLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <p className="text-2xl font-bold">{todayCount}</p>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Cash Today</p>
              {summaryLoading ? <Skeleton className="h-8 w-24" /> : <p className="text-2xl font-bold text-green-600">{formatCurrency(0)}</p>}
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Goods Today</p>
              {summaryLoading ? <Skeleton className="h-8 w-16" /> : <p className="text-2xl font-bold text-blue-600">0</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <button
              onClick={() => navigate("/pos/search")}
              className="w-full text-left flex items-center gap-2 p-2 rounded-md bg-primary/5 text-primary hover:bg-primary/10 transition-colors text-sm font-medium"
            >
              <Search className="h-4 w-4" /> Find Voucher
            </button>
            <button
              onClick={() => navigate("/pos/transactions")}
              className="w-full text-left flex items-center gap-2 p-2 rounded-md bg-muted hover:bg-muted/80 transition-colors text-sm"
            >
              <Receipt className="h-4 w-4" /> View Transactions
            </button>
          </CardContent>
        </Card>
      </div>

      {/* Quick Navigation Cards */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Modules</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {quickActions.map((action) => (
            <button
              key={action.path}
              onClick={() => navigate(action.path)}
              className="text-left group"
            >
              <Card className="transition-all hover:shadow-md cursor-pointer h-full">
                <CardContent className="p-6">
                  <div className={`inline-flex p-3 rounded-lg mb-4 transition-colors ${action.color}`}>
                    {action.icon}
                  </div>
                  <h3 className="font-semibold mb-1">{action.title}</h3>
                  <p className="text-xs text-muted-foreground">{action.description}</p>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}