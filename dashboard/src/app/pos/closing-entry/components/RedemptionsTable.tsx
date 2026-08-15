/** Table displaying the Entitlement Redemptions linked to the current POS session. */

import { AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RedemptionRow } from "../types";
import { fmt } from "../utils";

interface Props {
  redemptions: RedemptionRow[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function RedemptionsTable({
  redemptions,
  isLoading,
  error,
  onRetry,
}: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Reference</TableHead>
          <TableHead>Party</TableHead>
          <TableHead>Item</TableHead>
          <TableHead className="text-right">Qty</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center py-8">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading redemptions…
              </div>
            </TableCell>
          </TableRow>
        ) : error && redemptions.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center py-8">
              <div className="flex flex-col items-center gap-2">
                <AlertCircle className="h-6 w-6 text-destructive" />
                <p className="text-destructive text-sm">{error}</p>
                <Button variant="outline" size="sm" onClick={onRetry}>
                  Retry
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ) : redemptions.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
              No redemptions found for this session.
            </TableCell>
          </TableRow>
        ) : (
          redemptions.map((r) => (
            <TableRow key={r.entitlement_redemption}>
              <TableCell className="font-mono text-xs">
                {r.entitlement_redemption}
              </TableCell>
              <TableCell className="text-sm">
                {r.party || "—"}
              </TableCell>
              <TableCell className="text-sm">{r.item || "—"}</TableCell>
              <TableCell className="text-right">{r.qty || 0}</TableCell>
              <TableCell className="text-right">{fmt(r.grand_total ?? 0)}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}