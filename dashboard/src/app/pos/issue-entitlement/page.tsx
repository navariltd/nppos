/**
 * IssueEntitlement – creates and submits an Entitlement Redemption via savedocs.
 * Shows validation errors inline (card) for better visibility.
 */

"use client";

import { useNavigate, useSearchParams } from "react-router-dom";
import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk";
import { ArrowLeft, Banknote, Package, CheckCircle, Loader2, AlertTriangle, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { isPermissionError, parseFrappeError } from "@/components/doctype/form/parse-error";

/** Format currency. */
function fmt(val: number | null | undefined): string {
  if (val == null) return "—";
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", minimumFractionDigits: 0 }).format(val);
}

/** Extract the root error message from Frappe error response. */
function extractErrorMessage(err: any): string {
  if (err?._server_messages) {
    try {
      const messages = JSON.parse(err._server_messages);
      if (Array.isArray(messages) && messages.length > 0) {
        const parsed = typeof messages[0] === "string" ? JSON.parse(messages[0]) : messages[0];
        return parsed?.message || parsed?.title || "Validation error";
      }
    } catch {}
  }
  if (err?.exception) {
    const match = err.exception.match(/ValidationError: (.+)/);
    if (match) return match[1];
    return err.exception;
  }
  return parseFrappeError(err);
}

export default function IssueEntitlement() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const voucherName = searchParams.get("voucher");

  const [redeemAmount, setRedeemAmount] = useState<string>("");
  const [redeemQty, setRedeemQty] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const vKey: any = voucherName ? `issue-v-${voucherName}` : null;
  const vParams: any = vKey ? { doctype: "Entitlement Voucher", name: voucherName } : {};
  const { data: voucherRaw, error: voucherError, isLoading: voucherLoading } = useFrappeGetCall(
    vKey ? "frappe.client.get" : null,
    vParams,
    vKey,
  ) as any;

  const rKey: any = voucherName ? `issue-red-${voucherName}` : null;
  const rParams: any = rKey
    ? {
        doctype: "Entitlement Redemption",
        fields: JSON.stringify(["name", "amount", "qty"]),
        filters: JSON.stringify([
          ["Entitlement Redemption", "entitlement_voucher", "=", voucherName],
          ["Entitlement Redemption", "docstatus", "=", 1],
        ]),
        limit_page_length: 999,
      }
    : {};
  const { data: redemptionsRaw } = useFrappeGetCall(rKey ? "frappe.client.get_list" : null, rParams, rKey) as any;

  const { call: savedocs } = useFrappePostCall("frappe.desk.form.save.savedocs");

  const voucher = (voucherRaw as any)?.message || (voucherRaw as any)?.data || null;
  const redemptions = (redemptionsRaw as any)?.message || [];
  const isCash = voucher?.entitlement_type === "Cash";

  const totalAmount = voucher?.amount || 0;
  const totalQty = voucher?.qty || 0;
  const redeemedAmount = redemptions.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
  const redeemedQty = redemptions.reduce((sum: number, r: any) => sum + (Number(r.qty) || 0), 0);
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
    if (!voucherName || !canSubmit) return;
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const doc: Record<string, any> = {
        doctype: "Entitlement Redemption",
        entitlement_voucher: voucherName,
        entitlement_type: voucher.entitlement_type,
        company: voucher.company,
        party_type: voucher.party_type,
        party: voucher.party,
        cost_center: voucher.cost_center,
        project: voucher.project,
        agent: voucher.agent,
        merchant: voucher.merchant,
        warehouse: voucher.warehouse,
        description: voucher.description,
        posting_date: new Date().toISOString().slice(0, 10),
        letter_head: voucher.letter_head,
        group_same_items: voucher.group_same_items || 0,
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
        amount_eligible_for_commission: voucher.amount_eligible_for_commission || 0,
        commission_rate: voucher.commission_rate || 0,
        total_commission: voucher.total_commission || 0,
        sales_team: voucher.sales_team || [],
        naming_series: "ENT-RED-.YYYY.-.MM.-",
      };

      if (isCash) {
        doc.amount = parsedAmount;
        doc.rate = voucher.rate || 1;
        doc.currency = voucher.currency;
      } else {
        doc.item = voucher.item;
        doc.qty = parsedQty;
        doc.uom = voucher.uom;
      }

      const result = await savedocs({ doc: JSON.stringify(doc), action: "Submit" });
      const name = (result as any)?.message?.name || (result as any)?.name || "";
      navigate(`/pos/search?voucher=${voucherName}`);
    } catch (err: any) {
      const msg = extractErrorMessage(err);
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (voucherLoading) return <div className="px-4 lg:px-6 space-y-6 pb-8"><Skeleton className="h-40 w-full rounded-lg" /><Skeleton className="h-60 w-full rounded-lg" /></div>;

  if (voucherError) return <div className="px-4 lg:px-6 space-y-6 pb-8"><Card className="border-destructive/50"><CardContent className="pt-6 text-destructive text-sm">Failed to load voucher: {parseFrappeError(voucherError)}</CardContent></Card></div>;

  if (!voucher) return <div className="px-4 lg:px-6 space-y-6 pb-8"><Card><CardContent className="pt-6"><p className="text-muted-foreground">No voucher specified. Use Search to find a voucher first.</p><Button variant="outline" className="mt-4" onClick={() => navigate("/pos/search")}><ArrowLeft className="h-4 w-4 mr-2" /> Back to Search</Button></CardContent></Card></div>;

  return (
    <div className="px-4 lg:px-6 space-y-6 pb-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/pos/search")}><ArrowLeft className="h-5 w-5" /></Button>
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-tight">{isCash ? "Issue Cash Entitlement" : "Issue Goods / Hampers"}</h1>
          <p className="text-muted-foreground">Voucher: {voucher.voucher_number || voucher.name}</p>
        </div>
      </div>

      {/* Voucher Summary */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg">{isCash ? <Banknote className="h-5 w-5 text-green-500" /> : <Package className="h-5 w-5 text-blue-500" />} Voucher Summary</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="space-y-1"><p className="text-xs text-muted-foreground">Party</p><p className="font-medium">{voucher.party || "—"}</p></div>
          <div className="space-y-1"><p className="text-xs text-muted-foreground">DocStatus</p><Badge variant="default">Submitted</Badge></div>
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

      {/* Submit Error - red card with full message */}
      {submitError && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6 flex items-start gap-3">
            <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-destructive">Submission Failed</p>
              <p className="text-sm text-destructive/80 mt-1 whitespace-pre-wrap">{submitError}</p>
              <p className="text-xs text-destructive/60 mt-2">Check the voucher configuration (paid_from, paid_to, etc.) and try again.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Redemption Form */}
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
              <li className="flex items-start gap-2"><AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> Ensure the voucher has accounting details configured (paid_from, paid_to)</li>
              <li className="flex items-start gap-2"><AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" /> Double-check the amount/qty before confirming</li>
            </ul>
          </div>

          <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting} size="lg" className="w-full gap-2">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            {isSubmitting ? "Submitting..." : isCash ? `Redeem ${fmt(parsedAmount)}` : `Issue ${parsedQty} ${voucher.uom || "Units"}`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}