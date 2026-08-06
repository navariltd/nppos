/**
 * IssueEntitlement – creates a LOCAL Entitlement Redemption duplicate that works
 * fully offline (the source of truth), then queues it for push via sync_push.
 * When online it auto-syncs; when offline it stays as `pending`.
 */

"use client";

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CheckCircle,
  Loader2,
  Package,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useOffline } from "@/contexts/offline-context";
import { usePOS } from "@/contexts/pos-context";
import { redemptionRepo, voucherRepo } from "@/lib/offline/repository";
import type { OfflineRedemption, OfflineVoucher } from "@/lib/offline/db";

/** Format a number as Kenyan Shillings, or an em-dash when null/undefined. */
function fmt(val: number | null | undefined): string {
  if (val == null) return "—";
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", minimumFractionDigits: 0 }).format(val);
}

/**
 * IssueEntitlement – creates a LOCAL Entitlement Redemption that works fully
 * offline, then queues it for push via sync_push (auto-syncs when online).
 *
 * @returns {JSX.Element} the redemption form
 */
export default function IssueEntitlement() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const voucherName = searchParams.get("voucher");

  const { isOnline, queueRedemption } = useOffline();
  const { posOpeningEntry } = usePOS();

  const openingName = Array.isArray(posOpeningEntry)
    ? posOpeningEntry[0]?.name ?? ""
    : posOpeningEntry?.name ?? "";

  const [redeemAmount, setRedeemAmount] = useState<string>("");
  const [redeemQty, setRedeemQty] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Voucher ALWAYS comes from the local Dexie DB (offline-first source of truth).
  const [voucher, setVoucher] = useState<any>(null);
  const [localRedemptions, setLocalRedemptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!voucherName) {
      setLoading(false);
      return;
    }
    const name = voucherName;
    voucherRepo.getById(name).then((v: OfflineVoucher | undefined) => {
      if (v) {
        setVoucher({
          ...(v.raw || {}),
          name: v.id,
          voucher_number: v.voucher_no,
          party: v.beneficiary_no,
          entitlement_type: v.entitlement_type === "cash" ? "Cash" : "Goods",
          amount: v.amount,
          qty: v.qty,
          item: v.hamper_id,
          uom: v.uom,
          rate: v.rate,
        });
      } else {
        setVoucher(null);
      }
      setLoading(false);
    });
  }, [voucherName]);

  useEffect(() => {
    if (voucherName) {
      const name = voucherName;
      redemptionRepo.getAll().then((all: OfflineRedemption[]) => {
        setLocalRedemptions(all.filter((r) => r.voucherNo === name));
      });
    }
  }, [voucherName]);

  const isCash = voucher?.entitlement_type === "Cash";

  const totalAmount = voucher?.amount || 0;
  const totalQty = voucher?.qty || 0;
  const redeemedAmount = localRedemptions.reduce(
    (s, r) => s + (Number(r.amount) || 0),
    0,
  );
  const redeemedQty = localRedemptions.reduce(
    (s, r) => s + (Number(r.qty) || 0),
    0,
  );
  const remainingAmount = Math.max(0, totalAmount - redeemedAmount);
  const remainingQty = Math.max(0, totalQty - redeemedQty);

  const parsedAmount = parseFloat(redeemAmount) || 0;
  const parsedQty = parseFloat(redeemQty) || 0;
  const isValidAmount = isCash ? parsedAmount > 0 && parsedAmount <= remainingAmount : true;
  const isValidQty = !isCash ? parsedQty > 0 && parsedQty <= remainingQty : true;
  const canSubmit = isCash ? isValidAmount : isValidQty;

  useEffect(() => {
    if (isCash && remainingAmount > 0) setRedeemAmount(String(remainingAmount));
    if (!isCash && remainingQty > 0) setRedeemQty(String(remainingQty));
  }, [voucher, isCash, remainingAmount, remainingQty]);

  const handleSubmit = async () => {
    if (!voucherName || !voucher || !canSubmit) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      // ALWAYS create the local redemption (offline-first), pushing when online.
      await queueRedemption({
        kind: isCash ? "cash_payment" : "goods_issue",
        voucherNo: voucherName,
        entitlementType: isCash ? "Cash" : "Goods",
        ...(isCash ? { amount: parsedAmount } : { qty: parsedQty }),
        ...(openingName ? { posSession: openingName } : {}),
        ...(voucher.warehouse ? { warehouse: voucher.warehouse } : {}),
        voucherSnapshot: {
          name: voucherName,
          entitlement_type: voucher.entitlement_type,
          company: voucher.company,
          party: voucher.party,
          party_type: voucher.party_type,
          cost_center: voucher.cost_center,
          project: voucher.project,
          agent: voucher.agent,
          merchant: voucher.merchant,
          warehouse: voucher.warehouse,
          description: voucher.description,
          letter_head: voucher.letter_head,
          group_same_items: voucher.group_same_items,
          language: voucher.language,
          select_print_heading: voucher.select_print_heading,
          paid_from: voucher.paid_from,
          paid_from_account_currency: voucher.paid_from_account_currency,
          paid_to: voucher.paid_to,
          paid_to_account_currency: voucher.paid_to_account_currency,
          bank_account: voucher.bank_account,
          party_bank_account: voucher.party_bank_account,
          party_bank_account_name: voucher.party_bank_account_name,
          party_bank_account_no: voucher.party_bank_account_no,
          sales_partner: voucher.sales_partner,
          amount_eligible_for_commission: voucher.amount_eligible_for_commission,
          commission_rate: voucher.commission_rate,
          total_commission: voucher.total_commission,
          rate: voucher.rate,
          currency: voucher.currency,
          item: voucher.item,
          uom: voucher.uom,
        },
      });

      toast.success(
        isOnline
          ? "Redemption recorded and will sync."
          : "Redemption recorded offline. It will sync when you reconnect.",
      );
      navigate(`/pos/search?voucher=${voucherName}`);
    } catch (err: any) {
      setSubmitError(err?.message ?? "Failed to record redemption");
      toast.error(err?.message ?? "Failed to record redemption");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="px-4 lg:px-6 space-y-6 pb-8"><Skeleton className="h-40 w-full rounded-lg" /><Skeleton className="h-60 w-full rounded-lg" /></div>;

  if (!voucher) return <div className="px-4 lg:px-6 space-y-6 pb-8"><Card><CardContent className="pt-6"><p className="text-muted-foreground">No voucher found in local data. Use Search to find a voucher first.</p><Button variant="outline" className="mt-4" onClick={() => navigate("/pos/search")}><ArrowLeft className="h-4 w-4 mr-2" /> Back to Search</Button></CardContent></Card></div>;

  return (
    <div className="px-4 lg:px-6 space-y-6 pb-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/pos/search")}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-tight">{isCash ? "Issue Cash Entitlement" : "Issue Goods / Hampers"}</h1>
          <p className="text-muted-foreground">Voucher: {voucher.voucher_number || voucher.name}</p>
        </div>
      </div>

      {!isOnline && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
            <div>
              <p className="font-medium text-amber-700 dark:text-amber-300">You are offline</p>
              <p className="text-sm text-muted-foreground">
                This redemption will be saved locally and synced when you reconnect.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg">{isCash ? <Banknote className="h-5 w-5 text-green-500" /> : <Package className="h-5 w-5 text-blue-500" />} Voucher Summary</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-1"><p className="text-xs text-muted-foreground">Party</p><p className="font-medium">{voucher.party || "—"}</p></div>
          <div className="space-y-1"><p className="text-xs text-muted-foreground">Status</p><Badge variant="secondary">Local</Badge></div>
          {isCash ? (
            <>
              <div className="space-y-1"><p className="text-xs text-muted-foreground">Total Amount</p><p className="font-semibold">{fmt(totalAmount)}</p></div>
              <div className="space-y-1"><p className="text-xs text-muted-foreground">Remaining</p><p className="font-bold text-green-600">{fmt(remainingAmount)}</p></div>
            </>
          ) : (
            <>
              <div className="space-y-1"><p className="text-xs text-muted-foreground">Total Qty</p><p className="font-semibold">{totalQty}</p></div>
              <div className="space-y-1"><p className="text-xs text-muted-foreground">Remaining</p><p className="font-bold text-blue-600">{remainingQty}</p></div>
            </>
          )}
        </CardContent>
      </Card>

      {submitError && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6 flex items-start gap-3">
            <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-destructive">Recording Failed</p>
              <p className="text-sm text-destructive/80 mt-1 whitespace-pre-wrap">{submitError}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-lg">Redemption Details</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          {isCash ? (
            <div className="space-y-2">
              <Label htmlFor="amount">Amount to Redeem</Label>
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">KES</span>
                  <Input id="amount" type="number" className="pl-12" value={redeemAmount}
                    onChange={(e) => setRedeemAmount(e.target.value)}
                    max={remainingAmount} min={0} step={0.01} />
                </div>
              </div>
              {!isValidAmount && redeemAmount && <p className="text-xs text-destructive">Amount exceeds remaining balance ({fmt(remainingAmount)})</p>}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="qty">Quantity to Issue</Label>
              <div className="flex gap-2 items-center">
                <Input id="qty" type="number" value={redeemQty}
                  onChange={(e) => setRedeemQty(e.target.value)}
                  max={remainingQty} min={0} step={1} />
                <span className="text-muted-foreground text-sm">{voucher.uom || "Nos"}</span>
              </div>
              {!isValidQty && redeemQty && <p className="text-xs text-destructive">Quantity exceeds remaining ({remainingQty})</p>}
              {voucher.item && <p className="text-sm text-muted-foreground">Item: {voucher.item}</p>}
            </div>
          )}

          <div className="bg-muted/30 rounded-lg p-4 space-y-2">
            <p className="text-sm font-medium">Before you proceed:</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li className="flex items-start gap-2"><AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> Verify beneficiary details are correct</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> Double-check the amount/qty before confirming</li>
            </ul>
          </div>

          <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting} size="lg" className="w-full gap-2">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            {isSubmitting ? "Saving..." : isCash ? `Redeem ${fmt(parsedAmount)}` : `Issue ${parsedQty} ${voucher.uom || "Units"}`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}