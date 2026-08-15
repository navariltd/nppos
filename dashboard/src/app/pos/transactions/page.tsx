/**
 * RedemptionsPage – Entitlement Redemption list view with filtering, search,
 * correct status display and a click-to-open detail sheet.
 *
 * Offline-first: reads the local Dexie redemptions table (synced + pending +
 * failed) so the agent can review their redemption history without connectivity.
 */
"use client";

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { usePOS } from "@/contexts/pos-context";

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

/** Badge variant based on sync status. */
function statusVariant(status: string | undefined) {
  switch (status) {
    case "synced":
      return "outline" as const;
    case "pending":
      return "secondary" as const;
    case "failed":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

/** Human-readable status label. */
function statusLabel(status: string | undefined) {
  switch (status) {
    case "synced":
      return "Synced";
    case "pending":
      return "Pending";
    case "failed":
      return "Failed";
    default:
      return "Local";
  }
}

/**
 * RedemptionsPage – lists local Entitlement Redemptions with optional voucher
 * and search filtering. Reads the local Dexie table (offline-first).
 *
 * @returns {JSX.Element} the redemptions table + detail sheet
 */
export default function RedemptionsPage() {
  const navigate = useNavigate();
  const { posOpeningEntry } = usePOS();
  const openingRow = Array.isArray(posOpeningEntry) ? posOpeningEntry[0] : null;
  const openingName = openingRow?.name ?? "";
  const [searchParams] = useSearchParams();
  const voucherFilter = searchParams.get("entitlement_voucher");
  const searchFilter = searchParams.get("s") || "";

  const title = voucherFilter
    ? `Redemptions for ${voucherFilter}`
    : "Redemptions";

  // Offline: read local redemptions from Dexie.
  const [localRedemptions, setLocalRedemptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    redemptionRepo.getAll().then((all: OfflineRedemption[]) => {
      if (cancelled) return;
      // Only show redemptions for the current POS session.
      let rows = all
        .filter((r) => r.posSession === openingName)
        .map((r) => ({
        id: r.id,
        name: r.serverName || r.id,
        entitlement_voucher: r.voucherNo,
        entitlement_type: r.entitlementType,
        amount: r.amount ?? 0,
        qty: r.qty ?? 0,
        party: r.voucherSnapshot?.party ?? "",
        item: r.voucherSnapshot?.item ?? "",
        posting_date: r.createdAt.slice(0, 10),
        createdAt: r.createdAt,
        syncStatus: r.syncStatus,
        posSession: r.posSession,
        warehouse: r.warehouse,
        serverName: r.serverName,
          lastError: r.lastError,
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
  }, [voucherFilter, searchFilter, openingName]);

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
                  <TableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/pos/transactions/${r.id}`)}
                  >
                    <TableCell className="px-4 font-medium text-xs">
                      {r.name}
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
                    <TableCell className="text-xs">
                      <Badge variant={statusVariant(r.syncStatus)}>
                        {statusLabel(r.syncStatus)}
                      </Badge>
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
