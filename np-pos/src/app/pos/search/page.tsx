/**
 * SearchVoucher – search Entitlement Vouchers by voucher_number or beneficiary.
 * Voucher search returns 1 exact match. Beneficiary search returns ALL vouchers as a list.
 */

"use client";

import { usePOS } from "@/contexts/pos-context";
import { useFrappeGetCall } from "frappe-react-sdk";
import {
  ArrowRight,
  Banknote,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  Package,
  Search,
  Warehouse,
} from "lucide-react";
import * as React from "react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import {
  isPermissionError,
  parseFrappeError,
} from "@/components/doctype/form/parse-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SearchMode = "voucher" | "beneficiary";

/** Format currency. */
function fmt(val: number | null | undefined): string {
  if (val == null) return "—";
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 0,
  }).format(val);
}

/** Badge variant for docstatus. */
function dsVariant(
  ds: number,
): "default" | "secondary" | "outline" | "destructive" {
  if (ds === 1) return "default";
  if (ds === 0) return "secondary";
  return "outline";
}

function dsLabel(ds: number): string {
  if (ds === 1) return "Submitted";
  if (ds === 0) return "Draft";
  if (ds === 2) return "Cancelled";
  return "Unknown";
}

export default function SearchVoucher() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const voucherParam = searchParams.get("voucher");
  const beneParam = searchParams.get("bene");
  const { warehouse: defaultWarehouse } = usePOS();

  const initialMode: SearchMode = beneParam ? "beneficiary" : "voucher";
  const initialQuery = voucherParam || beneParam || "";

  const [searchMode, setSearchMode] = useState<SearchMode>(initialMode);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [searchedQuery, setSearchedQuery] = useState<string | null>(
    initialQuery || null,
  );
  const [selectedVoucher, setSelectedVoucher] = useState<any>(null);

  const mode = searchMode;
  const q = searchedQuery;

  // Fetch vouchers: exact 1 for voucher search, ALL for beneficiary search
  const limit = mode === "voucher" ? 1 : 999;
  // Build filters: docstatus=1, search term, and warehouse filter
  const filters: any[] = [["Entitlement Voucher", "docstatus", "=", 1]];
  if (defaultWarehouse) {
    filters.push(["Entitlement Voucher", "warehouse", "=", defaultWarehouse]);
  }
  if (mode === "voucher") {
    filters.push(["Entitlement Voucher", "voucher_number", "=", q]);
  } else if (q) {
    filters.push(["Entitlement Voucher", "party", "like", `%${q}%`]);
  }

  const swrKey = q ? `sv-${mode}-${q}-${defaultWarehouse || ""}` : null;
  const {
    data: listData,
    error: listError,
    isLoading: listLoading,
  } = useFrappeGetCall(
    q ? "frappe.client.get_list" : (null as any),
    (q
      ? ({
          doctype: "Entitlement Voucher",
          fields: JSON.stringify(["*"]),
          filters: JSON.stringify(filters),
          limit_page_length: limit,
          order_by: "creation desc",
        } as any)
      : {}) as any,
    swrKey as any,
  ) as any;

  const allVouchers = (listData as any)?.message || [];
  // For beneficiary mode with multiple results, show list until one is selected
  const showAsList =
    mode === "beneficiary" && allVouchers.length > 1 && !selectedVoucher;

  // Determine which voucher to show details for
  const activeVoucher =
    selectedVoucher || (!showAsList ? allVouchers[0] : null);
  const voucherName = activeVoucher?.name;

  // Fetch linked submitted redemptions for the active voucher
  const redFilters: any[] = [
    ["Entitlement Redemption", "entitlement_voucher", "=", voucherName],
    ["Entitlement Redemption", "docstatus", "=", 1],
  ];

  if (defaultWarehouse) {
    redFilters.push([
      "Entitlement Redemption",
      "warehouse",
      "=",
      defaultWarehouse,
    ]);
  }
  const { data: redRaw } = useFrappeGetCall(
    voucherName ? "frappe.client.get_list" : (null as any),
    voucherName
      ? ({
          doctype: "Entitlement Redemption",
          fields: JSON.stringify([
            "name",
            "amount",
            "qty",
            "creation",
            "entitlement_type",
            "posting_date",
            "owner",
          ]),
          filters: JSON.stringify(redFilters),
          limit_page_length: 999,
          order_by: "creation desc",
        } as any)
      : {},
    voucherName ? `sv-red-${voucherName}-${defaultWarehouse || ""}` : null,
  ) as any;

  const redemptions = (redRaw as any)?.message || [];
  const isCash = activeVoucher?.entitlement_type === "Cash";
  const isSubmitted = activeVoucher?.docstatus === 1;
  const totalAmount = activeVoucher?.amount || 0;
  const totalQty = activeVoucher?.qty || 0;
  const redeemedAmount = redemptions.reduce(
    (s: number, r: any) => s + (Number(r.amount) || 0),
    0,
  );
  const redeemedQty = redemptions.reduce(
    (s: number, r: any) => s + (Number(r.qty) || 0),
    0,
  );
  const remainingAmount = Math.max(0, totalAmount - redeemedAmount);
  const remainingQty = Math.max(0, totalQty - redeemedQty);
  const canRedeem =
    isSubmitted && (isCash ? remainingAmount > 0 : remainingQty > 0);

  const inputRef = React.useRef<HTMLInputElement>(null);

  // Global keydown listener: capture scanner input even when input is not focused
  React.useEffect(() => {
    let scanBuffer = "";
    let scanTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // If the input is already focused, let the normal handler deal with it
      if (document.activeElement === inputRef.current) return;

      // Ignore modifier keys, navigation keys, etc.
      if (e.key === "Shift" || e.key === "Control" || e.key === "Alt" || e.key === "Meta") return;
      if (e.key === "Tab" || e.key === "Escape") return;
      if (e.key.length !== 1 && e.key !== "Enter") return;

      // Capture scanner input: accumulate characters, on Enter trigger search
      if (e.key === "Enter") {
        const scanned = scanBuffer.trim();
        if (scanned) {
          e.preventDefault();
          // Auto-focus the input and set the scanned value
          inputRef.current?.focus();
          setSearchQuery(scanned);
          setSelectedVoucher(null);
          // Trigger the search immediately
          setTimeout(() => {
            setSearchedQuery(scanned);
            const params = new URLSearchParams();
            if (searchMode === "voucher") {
              params.set("voucher", scanned);
            } else {
              params.set("bene", scanned);
            }
            setSearchParams(params, { replace: true });
          }, 0);
        }
        scanBuffer = "";
        return;
      }

      // Accumulate characters with a debounce (reset buffer if user pauses typing)
      scanBuffer += e.key;
      if (scanTimeout) clearTimeout(scanTimeout);
      scanTimeout = setTimeout(() => {
        scanBuffer = "";
      }, 200);
    };

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      document.removeEventListener("keydown", handleGlobalKeyDown);
      if (scanTimeout) clearTimeout(scanTimeout);
    };
  }, [searchMode, setSearchParams]);

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    setSearchedQuery(searchQuery.trim());
    setSelectedVoucher(null);
    // Update URL to preserve search on back-navigation
    const params = new URLSearchParams();
    if (searchMode === "voucher") {
      params.set("voucher", searchQuery.trim());
    } else {
      params.set("bene", searchQuery.trim());
    }
    setSearchParams(params, { replace: true });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  return (
    <div className="px-4 lg:px-6 space-y-6 pb-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">
          Search Voucher / Entitlements
        </h1>
        <p className="text-muted-foreground">
          Find a submitted voucher by number or beneficiary
        </p>
        {defaultWarehouse && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Warehouse className="h-3 w-3" /> Filtering by warehouse:{" "}
            <span className="font-medium text-foreground">
              {defaultWarehouse}
            </span>
          </p>
        )}
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="w-full sm:w-48">
              <Label htmlFor="search-mode" className="sr-only">
                Search by
              </Label>
              <Select
                value={searchMode}
                onValueChange={(v) => setSearchMode(v as SearchMode)}
              >
                <SelectTrigger id="search-mode">
                  <SelectValue placeholder="Search by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="voucher">Voucher Number</SelectItem>
                  <SelectItem value="beneficiary">
                    Beneficiary Number
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 flex gap-2">
              <Input
                ref={inputRef}
                placeholder={
                  searchMode === "voucher"
                    ? "Enter voucher number... (scan anywhere)"
                    : "Enter beneficiary ID... (scan anywhere)"
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <Button
                onClick={handleSearch}
                disabled={!searchQuery.trim() || listLoading}
              >
                {listLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}{" "}
                Search
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {listError && (
        <Card className="border-destructive/50">
          <CardContent className="pt-6 text-destructive text-sm">
            {isPermissionError(listError)
              ? "Access denied."
              : parseFrappeError(listError)}
          </CardContent>
        </Card>
      )}

      {listLoading && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-48 w-full rounded-lg" />
        </div>
      )}

      {/* Beneficiary: Show voucher list */}
      {!listLoading && showAsList && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Active Vouchers for {searchedQuery} ({allVouchers.length})
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
                {allVouchers.map((v: any) => (
                  <TableRow
                    key={v.name}
                    className="cursor-pointer hover:bg-muted/30"
                    onClick={() => setSelectedVoucher(v)}
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
                        variant={dsVariant(v.docstatus)}
                        className="text-[10px]"
                      >
                        {dsLabel(v.docstatus)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs font-medium">
                      {v.entitlement_type === "Cash"
                        ? fmt(v.amount)
                        : `${v.qty || 0}`}
                    </TableCell>
                    <TableCell className="text-xs">
                      {v.valid_to || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      —
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Stay on same page, switch to voucher search
                            setSearchMode("voucher");
                            setSearchQuery(v.voucher_number || v.name);
                            setSearchedQuery(v.voucher_number || v.name);
                            setSelectedVoucher(v);
                            const params = new URLSearchParams();
                            params.set("voucher", v.voucher_number || v.name);
                            setSearchParams(params, { replace: true });
                          }}
                          title="View voucher details"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 text-xs gap-1 px-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(
                              `/pos/issue-entitlement?voucher=${v.name}`,
                            );
                          }}
                        >
                          {v.entitlement_type === "Cash" ? "Issue" : "Issue"}
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Voucher Details (shown when a single voucher is selected or voucher search returns 1) */}
      {!listLoading && activeVoucher && !showAsList && (
        <>
          {/* Voucher Details */}
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
                  {activeVoucher.voucher_number || activeVoucher.name}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">DocStatus</p>
                <Badge variant={dsVariant(activeVoucher.docstatus)}>
                  {dsLabel(activeVoucher.docstatus)}
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  Entitlement Type
                </p>
                <div className="flex items-center gap-1.5">
                  {isCash ? (
                    <Banknote className="h-4 w-4 text-green-500" />
                  ) : (
                    <Package className="h-4 w-4 text-blue-500" />
                  )}
                  <span>{activeVoucher.entitlement_type}</span>
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Company</p>
                <p className="font-medium">{activeVoucher.company || "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Party</p>
                <p className="font-medium">{activeVoucher.party || "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Party Type</p>
                <p className="font-medium">{activeVoucher.party_type || "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Valid From</p>
                <p className="font-medium">{activeVoucher.valid_from || "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Valid To</p>
                <p className="font-medium">{activeVoucher.valid_to || "—"}</p>
              </div>
              {isCash ? (
                <>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Total Amount
                    </p>
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
                    <p className="font-medium">{fmt(activeVoucher.rate)}</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Item</p>
                    <p className="font-medium">{activeVoucher.item || "—"}</p>
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

          {/* Action */}
          {canRedeem ? (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <p className="font-semibold">Ready to Process</p>
                  <p className="text-sm text-muted-foreground">
                    {isCash
                      ? `${fmt(remainingAmount)} remaining to redeem`
                      : `${remainingQty} ${activeVoucher.uom || "units"} remaining to issue`}
                  </p>
                </div>
                <Button
                  onClick={() =>
                    navigate(
                      `/pos/issue-entitlement?voucher=${activeVoucher.name}`,
                    )
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
            <Card className="border-muted">
              <CardContent className="pt-6">
                <p className="font-medium">
                  Status: {dsLabel(activeVoucher.docstatus)}
                </p>
                <p className="text-sm text-muted-foreground">
                  {activeVoucher.docstatus !== 1
                    ? "Only submitted vouchers can be redeemed."
                    : "This voucher has been fully redeemed."}
                </p>
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
                      <TableHead>By</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {redemptions.map((r: any) => (
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
                          {r.owner?.split("@")[0] || "—"}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() =>
                              navigate(`/app/entitlement-redemption/${r.name}`)
                            }
                            title="Open"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* No Results */}
      {!listLoading &&
        searchedQuery &&
        allVouchers.length === 0 &&
        !listError && (
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <p className="text-muted-foreground">
                No submitted voucher found matching your search.
              </p>
            </CardContent>
          </Card>
        )}
    </div>
  );
}
