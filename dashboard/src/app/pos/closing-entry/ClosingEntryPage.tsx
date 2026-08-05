/**
 * ClosingEntryPage – the POS closing entry screen.
 *
 * Renders the period/user details, invoice tables, payment reconciliation and
 * totals computed by the useClosingEntryData hook, and submits the closing
 * entry via the offline-first outbox.
 */
"use client";

import { Loader2, RefreshCw, Save } from "lucide-react";
import { Navigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@/contexts/user-context";
import { InvoicesTable } from "./components/InvoicesTable";
import { PaymentReconciliationTable } from "./components/PaymentReconciliationTable";
import { PeriodDetailsCard } from "./components/PeriodDetailsCard";
import { UserDetailsCard } from "./components/UserDetailsCard";
import { useClosingEntryData } from "./hooks/useClosingEntryData";
import { fmt } from "./utils";

/** Skeleton screen shown while opening-entry metadata loads. */
function SkeletonScreen() {
  return (
    <div className="px-4 lg:px-6 space-y-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}

/**
 * ClosingEntryPage – combines the closing-entry data hook with its rendering.
 *
 * @returns {JSX.Element} the closing entry page
 */
export default function ClosingEntryPage() {
  const { user, isLoading: userLoading } = useUser();
  const {
    company,
    posProfile,
    cashier,
    openingName,
    periodStart,
    periodEnd,
    setPeriodEnd,
    postingDate,
    setPostingDate,
    postingTime,
    setPostingTime,
    posInvoices,
    salesInvoices,
    payments,
    totals,
    isLoadingData,
    fetchError,
    loadData,
    handleClosingChange,
    isSaving,
    saveError,
    savedDocName,
    handleSave,
  } = useClosingEntryData();

  if (userLoading) return <SkeletonScreen />;
  if (!user) return <Navigate to="/auth/sign-in" replace />;

  const allInvoices = [...posInvoices, ...salesInvoices];
  const hasDifferences = payments.some((p) => Math.abs(p.difference) > 0.01);
  const hasInvoices = allInvoices.length > 0;

  return (
    <div className="px-4 lg:px-6 space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            POS Closing Entry
          </h1>
          <p className="text-muted-foreground text-sm">
            {company} · {posProfile} · Cashier: {cashier}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {savedDocName && (
            <span className="text-sm text-green-600 font-medium">
              ✓ Saved as {savedDocName}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={isLoadingData}
            className="gap-1"
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoadingData ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button
            size="lg"
            onClick={handleSave}
            disabled={isSaving || isLoadingData}
            className="gap-2"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {saveError && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-md text-sm">
          {saveError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PeriodDetailsCard
          periodStart={periodStart ? periodStart.slice(0, 16) : ""}
          periodEnd={periodEnd}
          postingDate={postingDate}
          postingTime={postingTime}
          onPeriodStartChange={() => {}}
          onPeriodEndChange={setPeriodEnd}
          onPostingDateChange={setPostingDate}
          onPostingTimeChange={setPostingTime}
        />
        <UserDetailsCard
          company={company}
          posProfile={posProfile}
          cashier={cashier}
          openingName={openingName}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Totals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-sm text-muted-foreground">Total Quantity</div>
              <div className="text-xl font-bold">{totals.total_quantity}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Net Total</div>
              <div className="text-xl font-bold">{fmt(totals.net_total)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total Taxes</div>
              <div className="text-xl font-bold">{fmt(totals.total_taxes)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Grand Total</div>
              <div className="text-xl font-bold text-green-600">
                {fmt(totals.grand_total)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Linked Invoices</CardTitle>
          <CardDescription>
            {allInvoices.length} invoice{allInvoices.length !== 1 ? "s" : ""} in
            this period
            {fetchError && !isLoadingData && (
              <span className="text-destructive ml-2">({fetchError})</span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {posInvoices.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">
                POS Transactions ({posInvoices.length})
              </h3>
              <InvoicesTable
                title="POS Invoices"
                invoices={posInvoices}
                isLoading={isLoadingData}
                error={null}
                onRetry={loadData}
              />
            </div>
          )}
          {salesInvoices.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold mb-2">
                Sales Invoice Transactions ({salesInvoices.length})
              </h3>
              <InvoicesTable
                title="Sales Invoices"
                invoices={salesInvoices}
                isLoading={isLoadingData}
                error={null}
                onRetry={loadData}
              />
            </div>
          )}
          {!hasInvoices && !isLoadingData && (
            <p className="text-center py-4 text-muted-foreground">
              No invoices found for the selected period.
            </p>
          )}
          {isLoadingData && (
            <div className="text-center py-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
              Loading invoices…
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Modes of Payment</CardTitle>
          <CardDescription>
            Payment Reconciliation — closing amounts and differences
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PaymentReconciliationTable
            payments={payments}
            onClosingChange={handleClosingChange}
          />
        </CardContent>
      </Card>

      {hasDifferences && !isSaving && (
        <p className="text-sm text-muted-foreground text-center">
          ⚠ Differences detected — verify closing amounts.
        </p>
      )}
    </div>
  );
}