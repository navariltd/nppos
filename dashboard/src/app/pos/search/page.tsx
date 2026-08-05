/**
 * SearchVoucher – search Entitlement Vouchers by voucher_number or beneficiary.
 *
 * Voucher search returns 1 exact match. Beneficiary search returns ALL vouchers
 * as a list. Offline-first: reads the local Dexie vouchers table (populated by
 * initialSync after opening entry); supports barcode scanning from anywhere.
 */
"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Package } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useOffline } from "@/contexts/offline-context";
import { usePOS } from "@/contexts/pos-context";
import { redemptionRepo, voucherRepo } from "@/lib/offline/repository";
import type { OfflineRedemption, OfflineVoucher } from "@/lib/offline/db";
import SearchBar from "./components/SearchBar";
import VoucherDetails from "./components/VoucherDetails";
import VoucherList from "./components/VoucherList";
import { fromOffline } from "./utils";

type SearchMode = "voucher" | "beneficiary";

/**
 * SearchVoucher – the voucher/beneficiary search page. Reads vouchers and
 * redemptions from the local Dexie DB (offline-first) and supports scanning.
 *
 * @returns {JSX.Element} the search page
 */
export default function SearchVoucher() {
  const [searchParams, setSearchParams] = useSearchParams();
  const voucherParam = searchParams.get("voucher");
  const beneParam = searchParams.get("bene");
  const { warehouse: defaultWarehouse } = usePOS();
  const { isOnline } = useOffline();

  const initialMode: SearchMode = beneParam ? "beneficiary" : "voucher";
  const initialQuery = voucherParam || beneParam || "";

  const [searchMode, setSearchMode] = useState<SearchMode>(initialMode);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [searchedQuery, setSearchedQuery] = useState<string | null>(
    initialQuery || null,
  );
  const [selectedVoucher, setSelectedVoucher] = useState<any>(null);
  const [localVouchers, setLocalVouchers] = useState<any[]>([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [localRedemptions, setLocalRedemptions] = useState<any[]>([]);

  const q = searchedQuery;

  useEffect(() => {
    let cancelled = false;
    if (!q) {
      setLocalVouchers([]);
      setLocalLoading(false);
      return () => {
        cancelled = true;
      };
    }
    setLocalLoading(true);

    voucherRepo.search(q).then((rows: OfflineVoucher[]) => {
      if (cancelled) return;
      let mapped = rows.map(fromOffline);
      if (searchMode === "voucher") {
        mapped = mapped.filter(
          (v) => v.status !== "redeemed" && v.status !== "expired",
        );
      }
      setLocalVouchers(mapped);
      setLocalLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [q, searchMode]);

  const allVouchers = localVouchers;
  const showAsList =
    searchMode === "beneficiary" &&
    allVouchers.length > 1 &&
    !selectedVoucher;

  const activeVoucher =
    selectedVoucher || (!showAsList ? allVouchers[0] : null);
  const voucherName = activeVoucher?.name;

  useEffect(() => {
    if (voucherName) {
      redemptionRepo.getAll().then((all: OfflineRedemption[]) => {
        const mine = all.filter((r) => r.voucherNo === voucherName);
        setLocalRedemptions(
          mine.map((r) => ({
            name: r.id,
            amount: r.amount ?? 0,
            qty: r.qty ?? 0,
            creation: r.createdAt,
            entitlement_type: r.entitlementType,
            posting_date: r.createdAt.slice(0, 10),
            owner: r.syncStatus,
            syncStatus: r.syncStatus,
          })),
        );
      });
    } else {
      setLocalRedemptions([]);
    }
  }, [voucherName]);

  const redemptions = localRedemptions;
  const isCash = activeVoucher?.entitlement_type === "Cash";
  const isSubmitted =
    activeVoucher?.docstatus === 1 ||
    activeVoucher?.status === "active" ||
    activeVoucher?.status === "partially_redeemed";
  const totalAmount = activeVoucher?.amount || 0;
  const totalQty = activeVoucher?.qty || 0;
  const redeemedAmount = redemptions.reduce(
    (s: number, r: any) => s + (Number(r.amount) || 0),
    0,
  );
  const redeemedQty = redemptions.reduce(
    (s: number, r: any) => s + (Number(r.qty) || 0),
    0,
  );
  const remainingAmount = Math.max(0, totalAmount - redeemedAmount);
  const remainingQty = Math.max(0, totalQty - redeemedQty);
  const canRedeem =
    isSubmitted &&
    isOnline &&
    (isCash ? remainingAmount > 0 : remainingQty > 0);

  const inputRef = React.useRef<HTMLInputElement>(null);

  // Global keydown listener captures scanner input even when unfocused.
  React.useEffect(() => {
    let scanBuffer = "";
    let scanTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement === inputRef.current) return;
      if (
        e.key === "Shift" ||
        e.key === "Control" ||
        e.key === "Alt" ||
        e.key === "Meta" ||
        e.key === "Tab" ||
        e.key === "Escape"
      )
        return;
      if (e.key.length !== 1 && e.key !== "Enter") return;

      if (e.key === "Enter") {
        const scanned = scanBuffer.trim();
        if (scanned) {
          e.preventDefault();
          inputRef.current?.focus();
          setSearchQuery(scanned);
          setSelectedVoucher(null);
          setTimeout(() => {
            setSearchedQuery(scanned);
            const params = new URLSearchParams();
            if (searchMode === "voucher") {
              params.set("voucher", scanned);
            } else {
              params.set("bene", scanned);
            }
            setSearchParams(params, { replace: true });
          }, 0);
        }
        scanBuffer = "";
        return;
      }

      scanBuffer += e.key;
      if (scanTimeout) clearTimeout(scanTimeout);
      scanTimeout = setTimeout(() => {
        scanBuffer = "";
      }, 200);
    };

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      document.removeEventListener("keydown", handleGlobalKeyDown);
      if (scanTimeout) clearTimeout(scanTimeout);
    };
  }, [searchMode, setSearchParams]);

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    setSearchedQuery(searchQuery.trim());
    setSelectedVoucher(null);
    const params = new URLSearchParams();
    if (searchMode === "voucher") {
      params.set("voucher", searchQuery.trim());
    } else {
      params.set("bene", searchQuery.trim());
    }
    setSearchParams(params, { replace: true });
  };

  const isLoading = localLoading;

  return (
    <div className="px-4 lg:px-6 space-y-6 pb-8">
      <SearchBar
        mode={searchMode}
        onModeChange={setSearchMode}
        query={searchQuery}
        onQueryChange={setSearchQuery}
        onSearch={handleSearch}
        isLoading={isLoading}
        warehouse={defaultWarehouse}
        inputRef={inputRef}
      />

      {!isOnline && q && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="pt-6 text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
            <Package className="h-4 w-4 shrink-0" />
            Offline — searching from the last synced voucher data.
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      )}

      {!isLoading && showAsList && (
        <VoucherList
          vouchers={allVouchers}
          query={searchedQuery || ""}
          onSelect={setSelectedVoucher}
        />
      )}

      {!isLoading && activeVoucher && !showAsList && (
        <VoucherDetails
          voucher={activeVoucher}
          redemptions={redemptions}
          isCash={isCash}
          isSubmitted={isSubmitted}
          isOnline={isOnline}
          totalAmount={totalAmount}
          totalQty={totalQty}
          redeemedAmount={redeemedAmount}
          redeemedQty={redeemedQty}
          remainingAmount={remainingAmount}
          remainingQty={remainingQty}
          canRedeem={canRedeem}
        />
      )}

      {!isLoading && searchedQuery && allVouchers.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <p className="text-muted-foreground">
              {isOnline
                ? "No submitted voucher found matching your search."
                : "No cached voucher found matching your search. Sync online to refresh."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}