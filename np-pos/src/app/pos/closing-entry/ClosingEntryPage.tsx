"use client";

/** POS Closing Entry page for reconciling payments and finalizing daily sessions.
 *
 * Fetches invoices from an active POS Opening Entry, displays payment
 * reconciliation with editable closing amounts, and saves/submits the
 * closing entry document via ERPNext's savedocs API.
 *
 * Key dependencies:
 *  - erpnext.accounts.doctype.pos_closing_entry.pos_closing_entry.get_invoices
 *  - frappe.desk.form.save.savedocs
 */

import { ClipboardList, Loader2, RefreshCw, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { usePOS } from "@/contexts/pos-context";
import { useUser } from "@/contexts/user-context";
import { callPost } from "@/lib/frappe-service";

import { InvoicesTable } from "./components/InvoicesTable";
import { PaymentReconciliationTable } from "./components/PaymentReconciliationTable";
import { PeriodDetailsCard } from "./components/PeriodDetailsCard";
import { UserDetailsCard } from "./components/UserDetailsCard";
import type {
  GetInvoicesResponse,
  Invoice,
  PaymentRow,
  TaxSummary,
  TotalsData,
} from "./types";
import { fmt, nowDate, nowDatetime, nowTime, toERPNextDatetime } from "./utils";

const GET_INVOICES_METHOD =
  "erpnext.accounts.doctype.pos_closing_entry.pos_closing_entry.get_invoices";

function SkeletonScreen() {
  return (
    <div className="px-4 lg:px-6 space-y-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}

export default function ClosingEntryPage() {
  const { user, isLoading: userLoading } = useUser();
  const navigate = useNavigate();
  const { posOpeningEntry, isLoadingMetadata } = usePOS();

  const openingRow = Array.isArray(posOpeningEntry) ? posOpeningEntry[0] : null;
  const openingName = openingRow?.name ?? "";

  const [company, setCompany] = useState("");
  const [posProfile, setPosProfile] = useState("");
  const [cashier, setCashier] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [postingDate, setPostingDate] = useState(nowDate());
  const [postingTime, setPostingTime] = useState(nowTime());
  const [periodEnd, setPeriodEnd] = useState(nowDatetime());

  const [posInvoices, setPosInvoices] = useState<Invoice[]>([]);
  const [salesInvoices, setSalesInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [taxes, setTaxes] = useState<TaxSummary[]>([]);
  const [totals, setTotals] = useState<TotalsData>({
    grand_total: 0,
    net_total: 0,
    total_quantity: 0,
    total_taxes: 0,
  });
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedDocName, setSavedDocName] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { post: fetchInvoices } =
    callPost<GetInvoicesResponse>(GET_INVOICES_METHOD);
  const { post: saveDocs } = callPost("frappe.desk.form.save.savedocs");
  const { post: getDoc } = callPost("frappe.desk.form.load.getdoc");

  const loadData = useCallback(async () => {
    if (!openingName) return;
    setIsLoadingData(true);
    setFetchError(null);

    try {
      const openingRes: any = await getDoc({
        doctype: "POS Opening Entry",
        name: openingName,
      });

      const openingDoc =
        openingRes?.message?.docs?.[0] ?? openingRes?.docs?.[0] ?? {};
      const balanceDetails: Array<{
        mode_of_payment: string;
        opening_amount: number;
      }> = openingDoc.balance_details ?? [];

      const comp = openingDoc.company ?? "";
      const profile = openingDoc.pos_profile ?? "";
      const cashierName = openingDoc.user ?? user?.name ?? "";
      const start = openingDoc.period_start_date ?? "";

      setCompany(comp);
      setPosProfile(profile);
      setCashier(cashierName);
      setPeriodStart(start);
      setPeriodEnd(nowDatetime());

      const initPayments: PaymentRow[] = balanceDetails.map(
        (bd: { mode_of_payment: string; opening_amount: number }, idx: number) => ({
          idx: idx + 1,
          mode_of_payment: bd.mode_of_payment,
          opening_amount: bd.opening_amount,
          expected_amount: bd.opening_amount,
          closing_amount: bd.opening_amount,
          difference: 0,
        }),
      );

      if (start && comp && profile) {
        const startDt = toERPNextDatetime(start);
        const endDt = toERPNextDatetime(nowDatetime());

        const invRes: any = await fetchInvoices({
          start: startDt,
          end: endDt,
          pos_profile: profile,
          user: cashierName,
        });

        const data: GetInvoicesResponse = invRes.message ?? invRes;

        const pos = data.invoices.filter(
          (i: Invoice) => i.doctype === "POS Invoice",
        );
        const sales = data.invoices.filter(
          (i: Invoice) => i.doctype === "Sales Invoice",
        );

        setPosInvoices(pos);
        setSalesInvoices(sales);
        setTaxes(data.taxes);

        const paymentMap = new Map<string, PaymentRow>();
        for (const ip of initPayments) paymentMap.set(ip.mode_of_payment, ip);

        for (const p of data.payments) {
          const existing = paymentMap.get(p.mode_of_payment);
          if (existing) {
            existing.expected_amount += p.amount;
            existing.closing_amount = existing.expected_amount;
            existing.difference = 0;
          } else {
            paymentMap.set(p.mode_of_payment, {
              idx: paymentMap.size + 1,
              mode_of_payment: p.mode_of_payment,
              opening_amount: 0,
              expected_amount: p.amount,
              closing_amount: p.amount,
              difference: 0,
            });
          }
        }

        setPayments(Array.from(paymentMap.values()));

        let gt = 0,
          nt = 0,
          tq = 0,
          tt = 0;
        for (const inv of data.invoices) {
          gt += inv.grand_total ?? 0;
          nt += inv.net_total ?? 0;
          tq += inv.total_qty ?? 0;
          tt += inv.total_taxes_and_charges ?? 0;
        }
        setTotals({
          grand_total: gt,
          net_total: nt,
          total_quantity: tq,
          total_taxes: tt,
        });
      } else {
        setPayments(initPayments);
      }
    } catch (err: any) {
      console.error("Failed to load data:", err);
      setFetchError(
        err?.messages?.[0] ?? err?.message ?? "Failed to load opening entry",
      );
    } finally {
      setIsLoadingData(false);
    }
  }, [openingName]);

  useEffect(() => {
    if (!isLoadingMetadata && openingName) {
      loadData();
    }
  }, [isLoadingMetadata, openingName, loadData]);

  const handleClosingChange = (idx: number, value: number) => {
    setPayments((prev) => {
      const next = [...prev];
      const row = { ...next[idx] };
      row.closing_amount = Math.max(0, value);
      row.difference = row.closing_amount - row.expected_amount;
      next[idx] = row;
      return next;
    });
  };

  const handleSave = async () => {
    if (!openingName || !company || !posProfile) return;
    setIsSaving(true);
    setSaveError(null);

    try {
      const localName = `new-pos-closing-entry-${Math.random().toString(36).slice(2, 12)}`;

      const doc: Record<string, any> = {
        docstatus: 0,
        doctype: "POS Closing Entry",
        name: localName,
        __islocal: 1,
        __unsaved: 1,
        owner: user?.name ?? "Administrator",
        pos_profile: posProfile,
        user: cashier,
        company,
        pos_opening_entry: openingName,
        period_start_date: toERPNextDatetime(periodStart),
        period_end_date: toERPNextDatetime(periodEnd),
        posting_date: postingDate,
        posting_time: postingTime,
        pos_invoices: posInvoices.map((i) => ({
          pos_invoice: i.name,
          posting_date: i.posting_date,
          grand_total: i.grand_total,
          customer: i.customer,
          is_return: i.is_return,
          return_against: i.return_against,
        })),
        sales_invoices: salesInvoices.map((i) => ({
          sales_invoice: i.name,
          posting_date: i.posting_date,
          grand_total: i.grand_total,
          customer: i.customer,
          is_return: i.is_return,
          return_against: i.return_against,
        })),
        payment_reconciliation: payments.map((p) => ({
          docstatus: 0,
          doctype: "POS Closing Entry Detail",
          name: `detail-${Math.random().toString(36).slice(2, 10)}`,
          __islocal: 1,
          __unsaved: 1,
          owner: user?.name ?? "Administrator",
          idx: p.idx,
          mode_of_payment: p.mode_of_payment,
          opening_amount: p.opening_amount,
          expected_amount: p.expected_amount,
          closing_amount: p.closing_amount,
          difference: p.difference,
        })),
        taxes: taxes.map((t) => ({
          account_head: t.account_head,
          amount: t.tax_amount,
        })),
        grand_total: totals.grand_total,
        net_total: totals.net_total,
        total_quantity: totals.total_quantity,
        total_taxes_and_charges: totals.total_taxes,
      };

      const saveRes: any = await saveDocs({
        doc: JSON.stringify(doc),
        action: "Save",
      });
      const savedDoc = saveRes?.docs?.[0];
      const savedName = savedDoc?.name ?? "";

      if (savedName) {
        setSavedDocName(savedName);

        const submitDoc = {
          ...savedDoc,
          doctype: "POS Closing Entry",
          name: savedName,
          docstatus: 0,
          sales_invoices: (
            saveRes?.message?.docs?.[0]?.sales_invoices ?? []
          ).map((si: any) => ({
            name: si.name,
            doctype: "Sales Invoice Reference",
            sales_invoice: si.sales_invoice,
            posting_date: si.posting_date,
            customer: si.customer,
            grand_total: si.grand_total,
            is_return: si.is_return ?? 0,
            parent: savedName,
            parentfield: "sales_invoices",
            parenttype: "POS Closing Entry",
          })),
          payment_reconciliation: (
            saveRes?.message?.docs?.[0]?.payment_reconciliation ?? []
          ).map((pr: any) => ({
            name: pr.name,
            doctype: "POS Closing Entry Detail",
            mode_of_payment: pr.mode_of_payment,
            opening_amount: pr.opening_amount,
            expected_amount: pr.expected_amount,
            closing_amount: pr.closing_amount,
            difference: pr.difference,
            parent: savedName,
            parentfield: "payment_reconciliation",
            parenttype: "POS Closing Entry",
          })),
          taxes: [],
        };

        const submitRes: any = await saveDocs({
          doc: JSON.stringify(submitDoc),
          action: "Submit",
        });

        if (submitRes?._server_messages) {
          window.location.reload();
        }
      }
    } catch (err: any) {
      setSaveError(err?.messages?.[0] ?? err?.message ?? "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  if (userLoading || (isLoadingMetadata && !posOpeningEntry))
    return <SkeletonScreen />;
  if (!user) return <Navigate to="/auth/sign-in" replace />;

  if (!openingName) {
    return (
      <div className="px-4 lg:px-6">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ClipboardList className="h-16 w-16 text-muted-foreground/40 mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Active POS Session</h2>
          <p className="text-muted-foreground max-w-md mb-6">
            You don't have an active POS opening entry.
          </p>
        </div>
      </div>
    );
  }

  const allInvoices = [...posInvoices, ...salesInvoices];
  const hasDifferences = payments.some((p) => Math.abs(p.difference) > 0.01);

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
              <div className="text-sm text-muted-foreground">
                Total Quantity
              </div>
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
          {allInvoices.length === 0 && !isLoadingData && (
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