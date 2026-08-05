/**
 * StockBalancePage – offline-first stock balance view for the agent's warehouse.
 *
 * Reads the stock balance (Bin levels) that was pulled into the local Dexie
 * database during initialSync after opening entry. Works fully offline — no
 * network calls. When online it can be refreshed with a manual sync.
 */

"use client";

import { useEffect, useState } from "react";

import { Boxes, Loader2, RefreshCw, Warehouse } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  OfflineWarning,
  useOffline,
} from "@/contexts/offline-context";
import { usePOS } from "@/contexts/pos-context";
import { stockRepo } from "@/lib/offline/repository";
import type { OfflineStock } from "@/lib/offline/db";

/**
 * StockBalancePage – offline-first stock balance view for the agent's
 * warehouse. Reads the Bin levels pulled into the local Dexie DB.
 *
 * @returns {JSX.Element} the stock balance table
 */
export default function StockBalancePage() {
  const { warehouse } = usePOS();
  const { isOnline, initialSync } = useOffline();

  const [rows, setRows] = useState<
    Array<{ hamper_id: string; hamper_name: string; on_hand: number; warehouse: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = () => {
    setLoading(true);
    stockRepo.getAll(warehouse ?? undefined).then((all: OfflineStock[]) => {
      setRows(
        all.map((s) => ({
          hamper_id: s.hamper_id,
          hamper_name: s.hamper_name,
          on_hand: s.on_hand,
          warehouse: s.warehouse,
        })),
      );
      setLoading(false);
    });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [warehouse]);

  const handleRefresh = async () => {
    if (!isOnline) return;
    setRefreshing(true);
    try {
      await initialSync();
      load();
    } finally {
      setRefreshing(false);
    }
  };

  const totalUnits = rows.reduce((s, r) => s + r.on_hand, 0);

  return (
    <div className="px-4 lg:px-6 space-y-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Boxes className="h-6 w-6 text-primary" /> Stock Balance
          </h1>
          <p className="text-muted-foreground text-xs flex items-center gap-1">
            <Warehouse className="h-3 w-3" />
            Warehouse:{" "}
            <span className="font-medium text-foreground">{warehouse || "—"}</span>
          </p>
          {!isOnline && <OfflineWarning />}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing || !isOnline}
          className="gap-1"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          {isOnline ? "Refresh" : "Offline"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">On-hand Stock</CardTitle>
          <div className="text-sm text-muted-foreground">
            {rows.length} item{rows.length !== 1 ? "s" : ""} · {totalUnits} total
            units
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="px-6 py-10 text-center text-muted-foreground">
              No stock balance available. Sync online to load it.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">Item Code</TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Warehouse</TableHead>
                  <TableHead className="text-right">On Hand</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={`${r.warehouse}-${r.hamper_id}`}>
                    <TableCell className="px-4 font-medium text-xs">
                      {r.hamper_id}
                    </TableCell>
                    <TableCell className="text-sm">{r.hamper_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {r.warehouse}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {r.on_hand}
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