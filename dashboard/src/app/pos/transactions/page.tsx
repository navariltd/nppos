/**
 * TransactionsPage – Entitlement Redemption list view with filtering and search.
 *
 * Key dependencies: uses generic DocTypeList for Entitlement Redemption with extra columns
 * and route options for filtering by voucher or specific redemption ID.
 */

"use client";

import { useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import { DocTypeList } from "@/components/doctype/DocTypeList";
import type { AppListColumn } from "@/components/doctype/types";

const extraColumns: AppListColumn[] = [
  { fieldname: "entitlement_voucher", label: "Voucher", fieldtype: "Link" },
  { fieldname: "entitlement_type", label: "Type", fieldtype: "Select" },
  { fieldname: "amount", label: "Amount", fieldtype: "Currency" },
  { fieldname: "party", label: "Beneficiary", fieldtype: "Dynamic Link" },
];

export default function TransactionsPage() {
  const [searchParams] = useSearchParams();
  const voucherFilter = searchParams.get("entitlement_voucher");
  const searchFilter = searchParams.get("s");

  const title = voucherFilter ? `Redemptions for ${voucherFilter}` : "Transactions";

  return (
    <div className="space-y-0">
      <DocTypeList
        doctype="Entitlement Redemption"
        title={title}
        extraColumns={extraColumns}
      />
    </div>
  );
}