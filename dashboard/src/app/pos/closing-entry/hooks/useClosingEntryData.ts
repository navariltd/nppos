/**
 * useClosingEntryData – fetches the POS Opening Entry, its linked invoices and
 * payment reconciliation rows, and exposes totals + save state for the Closing
 * Entry page. Works online (Frappe) and offline (cached opening entry).
 */
import { useCallback, useEffect, useState } from "react";

import { toast } from "sonner";

import { useOffline } from "@/contexts/offline-context";
import { usePOS } from "@/contexts/pos-context";
import { useUser } from "@/contexts/user-context";
import { callPost } from "@/lib/frappe-service";
import { pendingRepo } from "@/lib/offline/repository";
import type {
  GetInvoicesResponse,
  Invoice,
  PaymentRow,
  TaxSummary,
  TotalsData,
} from "../types";
import {
  initPaymentsFromBalance,
  mergePayments,
  sumTotals,
} from "../payment-utils";
import { nowDatetime, toERPNextDatetime } from "../utils";

const GET_INVOICES_METHOD =
  "erpnext.accounts.doctype.pos_closing_entry.pos_closing_entry.get_invoices";

interface ClosingEntryData {
  openingName: string;
  company: string;
  setCompany: (v: string) => void;
  posProfile: string;
  setPosProfile: (v: string) => void;
  cashier: string;
  setCashier: (v: string) => void;
  periodStart: string;
  periodEnd: string;
  setPeriodEnd: (v: string) => void;
  postingDate: string;
  setPostingDate: (v: string) => void;
  postingTime: string;
  setPostingTime: (v: string) => void;
  posInvoices: Invoice[];
  salesInvoices: Invoice[];
  payments: PaymentRow[];
  taxes: TaxSummary[];
  totals: TotalsData;
  isLoadingData: boolean;
  fetchError: string | null;
  loadData: () => Promise<void>;
  handleClosingChange: (idx: number, value: number) => void;
  isSaving: boolean;
  saveError: string | null;
  savedDocName: string | null;
  handleSave: () => Promise<void>;
}

export function useClosingEntryData(): ClosingEntryData {
  const { user } = useUser();
  const { posOpeningEntry, isLoadingMetadata, posProfile: activePosProfile } =
    usePOS();
  const { isOnline, syncNow } = useOffline();

  const openingRow = Array.isArray(posOpeningEntry) ? posOpeningEntry[0] : null;
  const openingName = openingRow?.name ?? "";
  const cachedCompany = openingRow?.company ?? "";
  const cachedCashier = openingRow?.user ?? "";
  const cachedProfile = openingRow?.pos_profile ?? activePosProfile?.name ?? "";
  const cachedStart = openingRow?.period_start_date ?? "";
  const cachedBalanceDetails: Array<{
    mode_of_payment: string;
    opening_amount: number;
  }> = openingRow?.balance_details ?? [];

  const [company, setCompany] = useState("");
  const [posProfile, setPosProfile] = useState("");
  const [cashier, setCashier] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [postingDate, setPostingDate] = useState(nowDatetime().slice(0, 10));
  const [postingTime, setPostingTime] = useState(nowDatetime().slice(11, 19));
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

      const initPayments = initPaymentsFromBalance(balanceDetails);

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
        setPayments(mergePayments(initPayments, data.payments));
        setTotals(sumTotals(data.invoices));
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
  }, [openingName]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isOnline) {
      if (!isLoadingMetadata && openingName) {
        loadData();
      }
    } else {
      // Offline: populate from the cached opening entry so the page is usable.
      setCompany(cachedCompany);
      setPosProfile(cachedProfile);
      setCashier(cachedCashier || user?.name || "");
      setPeriodStart(cachedStart);
      setPeriodEnd(nowDatetime());
      setPayments(initPaymentsFromBalance(cachedBalanceDetails));
      setIsLoadingData(false);
    }
  }, [isOnline, isLoadingMetadata, openingName, loadData]); // eslint-disable-line react-hooks/exhaustive-deps

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

    // Offline-first: always queue a pos_closing outbox entry locally so it
    // auto-syncs on reconnect; when online it pushes immediately.
    const countedCash = payments.reduce(
      (sum: number, p: PaymentRow) => sum + (p.closing_amount ?? 0),
      0,
    );
    const expectedCash = payments.reduce(
      (sum: number, p: PaymentRow) => sum + (p.expected_amount ?? 0),
      0,
    );
    const openingFloat = payments.reduce(
      (sum: number, p: PaymentRow) => sum + (p.opening_amount ?? 0),
      0,
    );

    try {
      await pendingRepo.enqueue({
        kind: "pos_closing",
        clientRef: `close_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        payload: {
          kind: "pos_closing",
          session: openingName,
          openingFloat,
          expectedCash,
          countedCash,
          difference: countedCash - expectedCash,
        },
      });
      setSavedDocName("queued");
      toast.success(
        isOnline
          ? "Closing entry saved and uploaded."
          : "Closing entry saved offline. It will sync when you reconnect.",
      );
      if (isOnline) {
        await syncNow().catch(() => {
          // It will retry via auto-sync.
        });
      }
    } catch (err: any) {
      setSaveError(err?.message ?? "Failed to queue closing entry");
    } finally {
      setIsSaving(false);
    }
  };

  return {
    openingName,
    company,
    setCompany,
    posProfile,
    setPosProfile,
    cashier,
    setCashier,
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
    taxes,
    totals,
    isLoadingData,
    fetchError,
    loadData,
    handleClosingChange,
    isSaving,
    saveError,
    savedDocName,
    handleSave,
  };
}