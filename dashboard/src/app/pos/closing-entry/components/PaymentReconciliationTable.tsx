/** Editable table for reconciling payment mode closing amounts against expected values. */

import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PaymentRow } from "../types";
import { fmt } from "../utils";

interface Props {
  payments: PaymentRow[];
  onClosingChange: (idx: number, value: number) => void;
}

export function PaymentReconciliationTable({
  payments,
  onClosingChange,
}: Props) {
  const sum = (fn: (r: PaymentRow) => number) =>
    payments.reduce((s, r) => s + fn(r), 0);

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">No.</TableHead>
            <TableHead>Mode of Payment</TableHead>
            <TableHead className="text-right">Opening Amount</TableHead>
            <TableHead className="text-right">Expected Amount</TableHead>
            <TableHead className="text-right">Closing Amount</TableHead>
            <TableHead className="text-right">Difference</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className="text-center py-8 text-muted-foreground"
              >
                No payment data. Select a POS Opening Entry and refresh.
              </TableCell>
            </TableRow>
          ) : (
            payments.map((row) => (
              <TableRow key={row.mode_of_payment}>
                <TableCell className="text-muted-foreground">
                  {row.idx}
                </TableCell>
                <TableCell className="font-medium">
                  {row.mode_of_payment}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {fmt(row.opening_amount)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {fmt(row.expected_amount)}
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={row.closing_amount}
                    onChange={(e) =>
                      onClosingChange(
                        row.idx - 1,
                        parseFloat(e.target.value) || 0,
                      )
                    }
                    className="w-28 ml-auto text-right h-8 font-mono"
                  />
                </TableCell>
                <TableCell
                  className={`text-right font-mono font-semibold ${Math.abs(row.difference) > 0.01 ? "text-destructive" : "text-muted-foreground"}`}
                >
                  {fmt(row.difference)}
                </TableCell>
              </TableRow>
            ))
          )}
          {payments.length > 0 && (
            <TableRow className="font-bold text-sm border-t-2">
              <TableCell />
              <TableCell>Total</TableCell>
              <TableCell className="text-right">
                {fmt(sum((r) => r.opening_amount))}
              </TableCell>
              <TableCell className="text-right">
                {fmt(sum((r) => r.expected_amount))}
              </TableCell>
              <TableCell className="text-right">
                {fmt(sum((r) => r.closing_amount))}
              </TableCell>
              <TableCell className="text-right">
                {fmt(sum((r) => r.difference))}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}