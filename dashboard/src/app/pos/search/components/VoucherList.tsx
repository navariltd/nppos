/**
 * VoucherList – table of matching vouchers for a beneficiary search, with
 * view-details and issue actions per row.
 */
import { ArrowRight, Banknote, ExternalLink, Package } from "lucide-react";
import type { MouseEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dsLabel, dsVariant, fmt } from "../utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Voucher = any;

interface VoucherListProps {
  vouchers: Voucher[];
  query: string;
  onSelect: (voucher: Voucher) => void;
}

export default function VoucherList({
  vouchers,
  query,
  onSelect,
}: VoucherListProps) {
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();

  const openVoucher = (v: Voucher) => {
    const name = v.voucher_number || v.name;
    onSelect(v);
    setSearchParams({ voucher: name }, { replace: true });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Active Vouchers for {query} ({vouchers.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="px-4">Voucher</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Amount/Qty</TableHead>
              <TableHead>Valid To</TableHead>
              <TableHead className="w-10">Remaining</TableHead>
              <TableHead className="w-40">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vouchers.map((v: Voucher) => (
              <TableRow
                key={v.name}
                className="cursor-pointer hover:bg-muted/30"
                onClick={() => onSelect(v)}
              >
                <TableCell className="px-4 font-medium text-xs">
                  {v.voucher_number || v.name}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {v.entitlement_type === "Cash" ? (
                      <Banknote className="h-3 w-3 text-green-500" />
                    ) : (
                      <Package className="h-3 w-3 text-blue-500" />
                    )}
                    <span className="text-xs">{v.entitlement_type}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={dsVariant(v.status ?? v.docstatus)}
                    className="text-[10px]"
                  >
                    {dsLabel(v.status ?? v.docstatus)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-xs font-medium">
                  {v.entitlement_type === "Cash"
                    ? fmt(v.amount)
                    : `${v.qty || 0}`}
                </TableCell>
                <TableCell className="text-xs">{v.valid_to || "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  —
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs px-2"
                      onClick={(e: MouseEvent) => {
                        e.stopPropagation();
                        openVoucher(v);
                      }}
                      title="View voucher details"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                    {v.status === "active" ||
                    v.status === "partially_redeemed" ? (
                      <Button
                        size="sm"
                        className="h-7 text-xs gap-1 px-2"
                        onClick={(e: MouseEvent) => {
                          e.stopPropagation();
                          navigate(`/pos/issue-entitlement?voucher=${v.name}`);
                        }}
                      >
                        Issue <ArrowRight className="h-3 w-3" />
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}