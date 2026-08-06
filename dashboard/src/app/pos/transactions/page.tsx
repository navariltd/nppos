/**
 * TransactionsPage – Entitlement Redemption list view with filtering and search.
 *
 * Offline-first: when online uses the generic DocTypeList (network). When offline
 * reads the local Dexie redemptions table (synced + pending) so the agent can
 * review their transaction history without connectivity.
 */

"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { redemptionRepo } from "@/lib/offline/repository";
import type { OfflineRedemption } from "@/lib/offline/db";

/** Format a number as Kenyan Shillings, or an em-dash when null/undefined. */
function fmt(val: number | null | undefined): string {
  if (val == null) return "—";
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 0,
  }).format(val);
}

/**
 * TransactionsPage – lists local Entitlement Redemptions with optional
 * voucher and search filtering. Reads the local Dexie table (offline-first).
 *
 * @returns {JSX.Element} the transactions table
 */
export default function TransactionsPage() {
  const [searchParams] = useSearchParams();
  const voucherFilter = searchParams.get("entitlement_voucher");
  const searchFilter = searchParams.get("s") || "";

  const title = voucherFilter ? `Redemptions for ${voucherFilter}` : "Transactions";

  // Offline: read local redemptions from Dexie.
  const [localRedemptions, setLocalRedemptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    redemptionRepo.getAll().then((all: OfflineRedemption[]) => {
      if (cancelled) return;
      let rows = all.map((r) => ({
        id: r.id,
        name: r.id,
        entitlement_voucher: r.voucherNo,
        entitlement_type: r.entitlementType,
        amount: r.amount ?? 0,
        qty: r.qty ?? 0,
        party: r.voucherSnapshot?.party ?? "",
        posting_date: r.createdAt.slice(0, 10),
        syncStatus: r.syncStatus,
      }));
      if (voucherFilter) {
        rows = rows.filter((r) => r.entitlement_voucher === voucherFilter);
      }
      if (searchFilter) {
        const q = searchFilter.toLowerCase();
        rows = rows.filter(
          (r) =>
            r.entitlement_voucher?.toLowerCase().includes(q) ||
            (r.party ?? "").toLowerCase().includes(q),
        );
      }
      rows.sort((a, b) => b.posting_date.localeCompare(a.posting_date));
      setLocalRedemptions(rows);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [voucherFilter, searchFilter]);

  return (
    <div className="space-y-6 px-0">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
            </div>
          ) : localRedemptions.length === 0 ? (
            <div className="px-6 py-10 text-center text-muted-foreground">
              No redemptions found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">Reference</TableHead>
                  <TableHead>Voucher</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount / Qty</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {localRedemptions.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="px-4 font-medium text-xs">
                      {r.syncStatus === "synced" ? (
                        r.name
                      ) : (
                        <span className="flex items-center gap-1">
                          {r.name}
                          <Badge
                            variant={
                              r.syncStatus === "failed"
                                ? "destructive"
                                : "secondary"
                            }
                            className="text-[9px]"
                          >
                            {r.syncStatus}
                          </Badge>
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.entitlement_voucher || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {r.entitlement_type || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs font-medium">
                      {r.entitlement_type === "Cash"
                        ? fmt(r.amount)
                        : `${r.qty || 0} pcs`}
                    </TableCell>
                    <TableCell className="text-xs">{r.posting_date}</TableCell>
                    <TableCell className="text-xs text-muted-foreground capitalize">
                      {r.syncStatus === "synced"
                        ? "Synced"
                        : r.syncStatus === "failed"
                          ? "Failed (will retry)"
                          : "Pending sync"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}