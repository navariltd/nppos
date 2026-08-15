/**
 * useClosingEntryData – reads the current POS Opening Entry from the cached
 * session and lists Entitlement Redemptions for that session **from the local
 * Dexie DB only** (never from the backend). The backend `autofill_entitlement_redemptions`
 * validate hook populates the child table automatically on the server when the
 * closing entry is created with `enable_entitlement_distribution = 1`.
 *
 * Saving: inserts a Draft POS Closing Entry (does NOT submit), then redirects
 * to the closing entry Form page so the backend has already autofilled the
 * redemptions. Finally clears local session redemptions so the next session
 * starts clean.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { toast } from "sonner";

import { useOffline } from "@/contexts/offline-context";
import { usePOS } from "@/contexts/pos-context";
import { useUser } from "@/contexts/user-context";
import { callPost } from "@/lib/frappe-service";
import { redemptionRepo } from "@/lib/offline/repository";
import type { OfflineRedemption } from "@/lib/offline/db";
import { initPaymentsFromBalance } from "../payment-utils";
import type { PaymentRow, RedemptionRow, TotalsData } from "../types";
import { nowDatetime } from "../utils";

interface ClosingEntryData {
  openingName: string;
  company: string;
  posProfile: string;
  cashier: string;
  periodStart: string;
  periodEnd: string;
  setPeriodEnd: (v: string) => void;
  postingDate: string;
  setPostingDate: (v: string) => void;
  postingTime: string;
  setPostingTime: (v: string) => void;
  redemptions: RedemptionRow[];
  payments: PaymentRow[];
  totals: TotalsData;
  isLoadingData: boolean;
  loadData: () => Promise<void>;
  handleClosingChange: (idx: number, value: number) => void;
  isSaving: boolean;
  saveError: string | null;
  savedDocName: string | null;
  handleSave: () => Promise<void>;
}

export function useClosingEntryData(): ClosingEntryData {
  const navigate = useNavigate();
  const { user } = useUser();
  const {
    posOpeningEntry,
    posProfile: activePosProfile,
  } = usePOS();
  const { requireOnline } = useOffline();
  const { post: insertDoc } = callPost("frappe.client.insert");

  const openingRow = Array.isArray(posOpeningEntry) ? posOpeningEntry[0] : null;
  const openingName = openingRow?.name ?? "";

  // Stable snapshot of the cached opening data so dependencies don't change on
  // every render (avoids the infinite re-render loop).
  const openingRef = useRef<{
    name: string;
    company: string;
    cashier: string;
    profile: string;
    start: string;
    balanceDetails: Array<{
      mode_of_payment: string;
      opening_amount: number;
    }>;
  } | null>(null);
  if (!openingRef.current || openingRef.current.name !== openingName) {
    openingRef.current = {
      name: openingName,
      company: openingRow?.company ?? "",
      cashier: openingRow?.user ?? "",
      profile: openingRow?.pos_profile ?? activePosProfile?.name ?? "",
      start: openingRow?.period_start_date ?? "",
      balanceDetails: openingRow?.balance_details ?? [],
    };
  }

  const [company, setCompany] = useState("");
  const [posProfile, setPosProfile] = useState("");
  const [cashier, setCashier] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [postingDate, setPostingDate] = useState(nowDatetime().slice(0, 10));
  const [postingTime, setPostingTime] = useState(nowDatetime().slice(11, 19));
  const [periodEnd, setPeriodEnd] = useState(nowDatetime());

  const [redemptions, setRedemptions] = useState<RedemptionRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [totals, setTotals] = useState<TotalsData>({
    grand_total: 0,
    net_total: 0,
    total_quantity: 0,
    total_taxes: 0,
  });
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedDocName, setSavedDocName] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  /** Build RedemptionRows from local (offline) redemptions for this session. */
  const buildFromLocal = useCallback(async (): Promise<{
    rows: RedemptionRow[];
    totals: TotalsData;
  }> => {
    const all = await redemptionRepo.getAll();
    const mine = all.filter((r: OfflineRedemption) => r.posSession === openingName);
    const rows = mine.map((r: OfflineRedemption): RedemptionRow => ({
      entitlement_redemption: r.serverName || r.id,
      posting_date: r.createdAt?.slice(0, 10) ?? "",
      party_type: r.voucherSnapshot?.party_type ?? "",
      party: r.voucherSnapshot?.party ?? "",
      item: r.voucherSnapshot?.item ?? "",
      qty: r.qty ?? 0,
      grand_total: r.amount ?? 0,
    }));
    let totalQty = 0;
    let grandTotal = 0;
    for (const r of rows) {
      totalQty += r.qty || 0;
      grandTotal += r.grand_total || 0;
    }
    return {
      rows,
      totals: {
        total_quantity: totalQty,
        net_total: grandTotal,
        grand_total: grandTotal,
        total_taxes: 0,
      },
    };
  }, [openingName]);

  /* Load data from the cached opening entry + local Dexie redemptions only. */
  const loadData = useCallback(async () => {
    if (!openingName) return;
    setIsLoadingData(true);

    const snap = openingRef.current;
    setCompany(snap?.company ?? "");
    setPosProfile(snap?.profile ?? "");
    setCashier(snap?.cashier || user?.name || "");
    setPeriodStart(snap?.start ?? "");
    setPeriodEnd(nowDatetime());
    setPayments(initPaymentsFromBalance(snap?.balanceDetails ?? []));

    const { rows, totals } = await buildFromLocal();
    rows.sort((a, b) => (a.posting_date || "").localeCompare(b.posting_date || ""));
    setRedemptions(rows);
    setTotals(totals);
    setIsLoadingData(false);
  }, [openingName, user?.name, buildFromLocal]);

  useEffect(() => {
    if (openingName) {
      loadData();
    }
  }, [openingName, loadData]);

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
      requireOnline();

      // Do NOT append entitlement_redemptions — the backend validate hook
      // `autofill_entitlement_redemptions` populates the child table from
      // Entitlement Redemption docs linked to this POS Opening Entry.
      const closingDoc = {
        doctype: "POS Closing Entry",
        pos_opening_entry: openingName,
        pos_profile: posProfile,
        company,
        user: cashier || user?.name,
        period_start_date: periodStart,
        period_end_date: periodEnd,
        posting_date: postingDate,
        posting_time: postingTime,
        enable_entitlement_distribution: 1,
        // Totals will be recalculated by the backend autofill.
        payment_reconciliation: payments.map((p) => ({
          mode_of_payment: p.mode_of_payment,
          opening_amount: p.opening_amount ?? 0,
          expected_amount: p.expected_amount ?? 0,
          closing_amount: p.closing_amount ?? 0,
          difference: (p.closing_amount ?? 0) - (p.expected_amount ?? 0),
        })),
      };

      // Insert a Draft POS Closing Entry (do NOT submit).
      const insertRes: any = await insertDoc({ doc: closingDoc });
      const name = insertRes?.message?.name ?? insertRes?.message ?? insertRes?.name;

      if (!name) {
        throw new Error("Failed to create POS Closing Entry.");
      }

      setSavedDocName(name);
      toast.success(`Closing entry ${name} created.`);

      // Clear local session redemptions so each session starts with clean data.
      const all = await redemptionRepo.getAll();
      const mine = all.filter((r: OfflineRedemption) => r.posSession === openingName);
      for (const r of mine) {
        await redemptionRepo.markSynced(r.id, r.serverName || `CLOSED-${name}`);
        await redemptionRepo.delete(r.id);
      }

      // Redirect to the closing entry Form page — backend autofill has already
      // populated the redemptions there.
      navigate(`/app/pos-closing-entry/${name}`);
    } catch (err: any) {
      if (err?.offline) {
        setSaveError(
          err?.message ??
            "You are offline. Closing entry requires an internet connection.",
        );
      } else {
        setSaveError(
          err?.messages?.[0] ?? err?.message ?? "Failed to create closing entry",
        );
      }
    } finally {
      setIsSaving(false);
    }
  };

  return {
    openingName,
    company,
    posProfile,
    cashier,
    periodStart,
    periodEnd,
    setPeriodEnd,
    postingDate,
    setPostingDate,
    postingTime,
    setPostingTime,
    redemptions,
    payments,
    totals,
    isLoadingData,
    loadData,
    handleClosingChange,
    isSaving,
    saveError,
    savedDocName,
    handleSave,
  };
}