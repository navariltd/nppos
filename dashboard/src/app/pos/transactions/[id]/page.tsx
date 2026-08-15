/**
 * RedemptionDetailPage – shows full details for a single entitlement redemption
 * with correct status, beneficiary details, and hamper components.
 */
"use client";

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { ArrowLeft, Banknote, Boxes, FileText, Loader2, Package, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  beneficiaryRepo, bomRepo, redemptionRepo,
} from "@/lib/offline/repository";
import type { OfflineBeneficiary, OfflineBom, OfflineRedemption } from "@/lib/offline/db";

const fmt = (val: number | null | undefined) =>
  val == null ? "—" : new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", minimumFractionDigits: 0 }).format(val);

function statusVariant(status?: string) {
  switch (status) {
    case "synced": return "outline" as const;
    case "pending": return "secondary" as const;
    case "failed": return "destructive" as const;
    default: return "outline" as const;
  }
}

function statusLabel(status?: string) {
  switch (status) {
    case "synced": return "Synced";
    case "pending": return "Pending";
    case "failed": return "Failed";
    default: return "Local";
  }
}

function LCell({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex flex-col px-4 py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium break-words">{value ?? "—"}</span>
    </div>
  );
}

export default function RedemptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [red, setRed] = useState<any>(null);
  const [beneficiary, setBeneficiary] = useState<OfflineBeneficiary | null>(null);
  const [bom, setBom] = useState<OfflineBom | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) { setNotFound(true); setLoading(false); return; }
    let cancelled = false;
    redemptionRepo.getById(id).then((r: OfflineRedemption | undefined) => {
      if (cancelled) return;
      if (!r) { setNotFound(true); setLoading(false); return; }
      const snap = r.voucherSnapshot || {};
      setRed({
        ...r,
        name: r.serverName || r.id,
        entitlement_voucher: r.voucherNo,
        entitlement_type: r.entitlementType,
        party: snap.party ?? "",
        party_type: snap.party_type ?? "",
        item: snap.item ?? "",
        uom: snap.uom ?? "",
        rate: snap.rate ?? null,
        company: snap.company ?? "",
        warehouse: snap.warehouse ?? r.warehouse ?? "",
        agent: snap.agent ?? "",
        merchant: snap.merchant ?? "",
        posting_date: r.createdAt.slice(0, 10),
      });
      if (snap.party && snap.party_type === "Beneficiary") {
        beneficiaryRepo.getById(snap.party).then((b: OfflineBeneficiary | undefined) => !cancelled && setBeneficiary(b ?? null));
      }
      if (snap.item) {
        bomRepo.getById(snap.item).then((b: OfflineBom | undefined) => !cancelled && setBom(b ?? null));
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…
    </div>
  );

  if (notFound || !red) return (
    <div className="px-4 lg:px-6 space-y-6">
      <BackHeader title="Redemption Details" />
      <Card><CardContent className="pt-6 text-center py-12 text-muted-foreground">
        <p>Redemption not found.</p>
        <Link to="/pos/transactions" className="mt-4 block"><Button variant="outline">Back to Redemptions</Button></Link>
      </CardContent></Card>
    </div>
  );

  const isCash = red.entitlement_type === "Cash";

  return (
    <div className="px-4 lg:px-6 space-y-6 pb-8">
      <BackHeader title="Redemption Details" subtitle={red.name} />

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-lg">Status</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Badge variant={statusVariant(red.syncStatus)}>{statusLabel(red.syncStatus)}</Badge>
            {red.lastError && <span className="text-sm text-destructive flex-1">{red.lastError}</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-lg">
          {isCash ? <Banknote className="h-5 w-5 text-green-500" /> : <Package className="h-5 w-5 text-blue-500" />} Summary
        </CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-px bg-muted/20">
            <LCell label="Type" value={red.entitlement_type} />
            <LCell label={isCash ? "Amount" : "Quantity"} value={isCash ? fmt(red.amount ?? 0) : `${red.qty || 0} pcs`} />
            <LCell label="Rate" value={red.rate != null ? fmt(red.rate) : null} />
            <LCell label="Company" value={red.company} />
            <LCell label="Warehouse" value={red.warehouse} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-lg">
          <User className="h-5 w-5 text-muted-foreground" /> Party Details
        </CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-muted/20">
            <LCell label="Party Type" value={red.party_type} />
            <LCell label="Party" value={red.party} />
            {beneficiary && (
              <>
                <LCell label="Full Name" value={beneficiary.full_name} />
                <LCell label="ID Number" value={beneficiary.id_number} />
                <LCell label="Phone" value={beneficiary.phone_number} />
                <LCell label="Email" value={beneficiary.email} />
                <LCell label="Type" value={beneficiary.beneficiary_type} />
                <LCell label="Proxy" value={beneficiary.is_proxy ? "Yes" : "No"} />
                <LCell label="Status" value={beneficiary.status} />
                <LCell label="Cached Warehouse" value={beneficiary.warehouse} />
              </>
            )}
            <LCell label="Agent" value={red.agent} />
            <LCell label="Merchant" value={red.merchant} />
          </div>
        </CardContent>
      </Card>

      {!isCash && bom && bom.components?.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-lg">
            <Boxes className="h-5 w-5 text-blue-500" /> Item & Hamper Components
          </CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-muted/20">
              <LCell label="Item" value={red.item} />
              <LCell label="UOM" value={red.uom} />
              <LCell label="Qty" value={red.qty ?? 0} />
              <LCell label="Rate" value={red.rate ?? 0} />
            </div>
            <div className="p-4 border-t">
              <p className="text-xs text-muted-foreground mb-2">
                Hamper Components{bom.name ? ` · ${bom.name}` : ""}
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Code</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>UOM</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bom.components.map((c: { item_code: string; item_name?: string; qty: number; uom: string }) => (
                    <TableRow key={c.item_code}>
                      <TableCell className="font-mono text-xs">{c.item_code}</TableCell>
                      <TableCell>{c.item_name || c.item_code}</TableCell>
                      <TableCell className="text-right">{c.qty}</TableCell>
                      <TableCell>{c.uom}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5 text-muted-foreground" /> Reference
        </CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-px bg-muted/20">
            <LCell label="Reference" value={red.name} />
            <LCell label="Voucher" value={red.entitlement_voucher} />
            <LCell label="Date" value={red.posting_date} />
            <LCell label="Time" value={red.createdAt?.slice(11, 19)} />
            <LCell label="POS Session" value={red.posSession} />
          </div>
          {red.serverName && (
            <div className="px-4 pb-3"><p className="text-sm"><span className="text-xs text-muted-foreground">Server Name: </span><span className="font-mono">{red.serverName}</span></p></div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Link to="/pos/transactions"><Button variant="outline" size="sm">Back to Redemptions</Button></Link>
      </div>
    </div>
  );
}

function BackHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-4">
      <Link to="/pos/transactions"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
      <div className="flex flex-col">
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-muted-foreground text-sm"><span className="font-mono">{subtitle}</span></p>}
      </div>
    </div>
  );
}