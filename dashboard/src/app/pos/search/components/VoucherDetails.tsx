/**
 * VoucherDetails – renders the detailed summary, action, and redemption
 * history sections for a single selected voucher in the search page.
 */
import {
  Banknote,
  Clock,
  FileText,
  Mail,
  Package,
  Phone,
  ArrowRight,
  User,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

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
import { dsLabel, dsVariant, fmt } from "../utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Voucher = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Redemption = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Beneficiary = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Bom = any;

interface VoucherDetailsProps {
  voucher: Voucher;
  redemptions: Redemption[];
  isCash: boolean;
  isSubmitted: boolean;
  isOnline: boolean;
  totalAmount: number;
  totalQty: number;
  redeemedAmount: number;
  redeemedQty: number;
  remainingAmount: number;
  remainingQty: number;
  canRedeem: boolean;
  beneficiary?: Beneficiary | null;
  bom?: Bom | null;
  hamperBalance?: number;
  noStock?: boolean;
}

export default function VoucherDetails({
  voucher,
  redemptions,
  isCash,
  isSubmitted,
  isOnline,
  totalAmount,
  totalQty,
  redeemedAmount,
  redeemedQty,
  remainingAmount,
  remainingQty,
  canRedeem,
  beneficiary,
  bom,
  hamperBalance = 0,
  noStock = false,
}: VoucherDetailsProps) {
  const navigate = useNavigate();

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" /> Voucher Details
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Voucher</p>
            <p className="font-semibold">
              {voucher.voucher_number || voucher.name}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge variant={dsVariant(voucher.status ?? voucher.docstatus)}>
              {dsLabel(voucher.status ?? voucher.docstatus)}
            </Badge>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Entitlement Type</p>
            <div className="flex items-center gap-1.5">
              {isCash ? (
                <Banknote className="h-4 w-4 text-green-500" />
              ) : (
                <Package className="h-4 w-4 text-blue-500" />
              )}
              <span>{voucher.entitlement_type}</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Company</p>
            <p className="font-medium">{voucher.company || "—"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Party</p>
            <p className="font-medium">
              {beneficiary?.full_name || voucher.party || "—"}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Party Type</p>
            <p className="font-medium">{voucher.party_type || "—"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Valid From</p>
            <p className="font-medium">{voucher.valid_from || "—"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Valid To</p>
            <p className="font-medium">{voucher.valid_to || "—"}</p>
          </div>
          {isCash ? (
            <>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Total Amount</p>
                <p className="font-semibold">{fmt(totalAmount)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Redeemed</p>
                <p className="font-medium">{fmt(redeemedAmount)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Remaining</p>
                <p className="font-bold text-lg text-green-600">
                  {fmt(remainingAmount)}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Rate</p>
                <p className="font-medium">{fmt(voucher.rate)}</p>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Item</p>
                <p className="font-medium">{voucher.item || "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Total Qty</p>
                <p className="font-semibold">{totalQty}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Redeemed</p>
                <p className="font-medium">{redeemedQty}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Remaining</p>
                <p className="font-bold text-lg text-blue-600">
                  {remainingQty}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Beneficiary Details (when party is a Beneficiary) */}
      {beneficiary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <User className="h-5 w-5 text-primary" /> Beneficiary Details
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Full Name</p>
              <p className="font-semibold">{beneficiary.full_name || "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Beneficiary No</p>
              <p className="font-medium">
                {beneficiary.id || voucher.party || "—"}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">ID Number</p>
              <p className="font-medium">{beneficiary.id_number || "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Proxy</p>
              <p className="font-medium">{beneficiary.is_proxy ? "Yes" : "No"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Beneficiary Type</p>
              <p className="font-medium">{beneficiary.beneficiary_type || "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="font-medium">{beneficiary.status || "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" /> Phone
              </p>
              <p className="font-medium">{beneficiary.phone_number || "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" /> Email
              </p>
              <p className="font-medium">{beneficiary.email || "—"}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hamper Components (when the voucher has a BOM) */}
      {bom && bom.components?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5 text-blue-500" /> Hamper Components
            </CardTitle>
            <div className="text-sm text-muted-foreground">
              {bom.name || voucher.item} · Available balance:{" "}
              <span
                className={
                  hamperBalance > 0
                    ? "text-green-600 font-medium"
                    : "text-destructive font-medium"
                }
              >
                {hamperBalance}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">Item</TableHead>
                  <TableHead className="text-right">Qty / Unit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bom.components.map((c: any) => (
                  <TableRow key={c.item_code}>
                    <TableCell className="px-4 font-medium text-xs">
                      {c.item_name || c.item_code}
                    </TableCell>
                    <TableCell className="text-right text-xs">
                      {c.qty} {c.uom}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Action */}
      {canRedeem ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="font-semibold">Ready to Process</p>
              <p className="text-sm text-muted-foreground">
                {isCash
                  ? `${fmt(remainingAmount)} remaining to redeem`
                  : `${remainingQty} ${voucher.uom || "units"} remaining to issue`}
              </p>
            </div>
            <Button
              onClick={() =>
                navigate(`/pos/issue-entitlement?voucher=${voucher.name}`)
              }
              size="lg"
              className="gap-2"
            >
              {isCash ? "Issue Cash" : "Issue Goods"}{" "}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className={noStock ? "border-destructive/50 bg-destructive/5" : "border-muted"}>
          <CardContent className="pt-6">
            <p className="font-medium">
              Status: {dsLabel(voucher.status ?? voucher.docstatus)}
            </p>
            {noStock ? (
              <p className="text-sm text-destructive font-medium mt-1">
                ⚠ Cannot redeem — no stock available for {voucher.item || "this item"}.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {!isSubmitted
                  ? "Only active vouchers within their validity period can be redeemed."
                  : "This voucher has been fully redeemed."}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Redemption History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-muted-foreground" /> Redemption
            History ({redemptions.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {redemptions.length === 0 ? (
            <div className="px-6 pb-6 text-sm text-muted-foreground">
              No redemptions yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="px-4">Reference</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount / Qty</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {redemptions.map((r: Redemption) => (
                  <TableRow key={r.name}>
                    <TableCell className="px-4 font-medium text-xs">
                      {r.name}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.posting_date || r.creation?.slice(0, 10)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {r.entitlement_type || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium text-xs">
                      {r.entitlement_type === "Cash"
                        ? fmt(r.amount)
                        : `${r.qty || 0} pcs`}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      Local
                    </TableCell>
                    <TableCell className="w-10"></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}