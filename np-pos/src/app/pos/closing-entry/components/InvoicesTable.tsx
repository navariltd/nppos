/** Table displaying fetched POS invoices or sales invoices with return status. */

import { AlertCircle, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Invoice } from "../types";
import { fmt, fmtDate } from "../utils";

interface Props {
  title: string;
  invoices: Invoice[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
}

export function InvoicesTable({
  title,
  invoices,
  isLoading,
  error,
  onRetry,
}: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Invoice</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Posting Date</TableHead>
          <TableHead className="text-right">Grand Total</TableHead>
          <TableHead className="text-right">Net Total</TableHead>
          <TableHead className="text-right">Qty</TableHead>
          <TableHead>Return</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading ? (
          <TableRow>
            <TableCell
              colSpan={7}
              className="text-center py-8"
            >
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading {title}…
              </div>
            </TableCell>
          </TableRow>
        ) : error ? (
          <TableRow>
            <TableCell
              colSpan={7}
              className="text-center py-8"
            >
              <div className="flex flex-col items-center gap-2">
                <AlertCircle className="h-6 w-6 text-destructive" />
                <p className="text-destructive text-sm">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRetry}
                >
                  Retry
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ) : invoices.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={7}
              className="text-center py-8 text-muted-foreground"
            >
              No {title} found.
            </TableCell>
          </TableRow>
        ) : (
          invoices.map((inv) => (
            <TableRow key={inv.name}>
              <TableCell className="font-mono text-xs">
                {inv.name}
              </TableCell>
              <TableCell>{inv.customer || "Walk-in"}</TableCell>
              <TableCell>{fmtDate(inv.posting_date)}</TableCell>
              <TableCell className="text-right">
                {fmt(inv.grand_total)}
              </TableCell>
              <TableCell className="text-right">
                {fmt(inv.net_total)}
              </TableCell>
              <TableCell className="text-right">
                {inv.total_qty}
              </TableCell>
              <TableCell>{inv.is_return ? "Yes" : "—"}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}