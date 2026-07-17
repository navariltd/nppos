/** Generic list view for Frappe doctypes. Uses sub-components from ./list/. */

"use client";

import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk";
import { ArrowUpDown, Clock, Loader2, Plus, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useUser } from "@/contexts/user-context";
import { cn } from "@/lib/utils";

import { DataTable } from "./list/DataTable";
import { FilterBar } from "./list/FilterBar";
import { PaginationBar } from "./list/PaginationBar";
import { SortDropdown } from "./list/SortDropdown";
import {
  DOCSTATUS_MAP,
  type ActiveFilter,
  type AppListColumn,
  type FilterItem,
} from "./types";
import { QUICK_DATE_RANGES, formatCellValue, timeAgo } from "./utils";

interface DocTypeListProps {
  doctype: string;
  title?: string;
  extraColumns?: AppListColumn[];
  onRowNavigate?: (name: string) => void;
}

export function DocTypeList({
  doctype,
  title,
  extraColumns = [],
  onRowNavigate,
}: DocTypeListProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading: userLoading } = useUser();
  const [searchParams, setSearchParams] = useSearchParams();

  const [rows, setRows] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [schemaFields, setSchemaFields] = useState<any[]>([]);
  const [childTableFields, setChildTableFields] = useState<
    Record<string, { doctype: string; fieldname: string }>
  >({});
  const [isSubmittable, setIsSubmittable] = useState(false);
  const [metaLoaded, setMetaLoaded] = useState(false);

  const [pageSize, setPageSize] = useState(20);
  const currentPage = Number(searchParams.get("page") || "1");

  const [sortField, setSortField] = useState("modified");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);

  const [activeFilters, setActiveFilters] = useState<
    Record<string, ActiveFilter>
  >({});
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());

  const [filterRows, setFilterRows] = useState<FilterItem[]>([]);
  const [showLikedOnly, setShowLikedOnly] = useState(false);

  // Sync to URL
  useEffect(() => {
    if (!metaLoaded) return;
    const params = new URLSearchParams();
    params.set("page", String(currentPage));
    params.set("sort", sortField);
    params.set("order", sortOrder);
    params.set("ps", String(pageSize));
    Object.entries(activeFilters).forEach(([key, f]) => {
      if (f.value) params.set(key, f.value);
    });
    setSearchParams(params, { replace: true });
  }, [activeFilters, currentPage, sortField, sortOrder, pageSize, metaLoaded]);

  // Fetch meta
  const { data: schemaData, error: schemaError } = useFrappeGetCall(
    "frappe.desk.form.load.getdoctype",
    { doctype },
    doctype ? `dtl-meta-${doctype}` : null,
  );

  // Build a lookup of child table fields: { fieldname: { doctype: "Child Table", fieldname: "item_code" } }
  const buildChildTableFieldMap = useCallback(
    (metaFields: any[]) => {
      const map: Record<string, { doctype: string; fieldname: string }> = {};
      if (!metaFields) return map;
      // Build meta for child tables as we encounter them
      const childTableDocTypes: string[] = [];
      metaFields.forEach((f: any) => {
        if (f.fieldtype === "Table") {
          childTableDocTypes.push(f.options);
        }
      });

      if (childTableDocTypes.length > 0) {
        // We have child tables - fetch their schema inline if available in the meta response
        // The schema response includes all child table field definitions in the docs array
        const allDocs = schemaData?.message?.docs ?? schemaData?.docs ?? [];
        allDocs.forEach((doc: any) => {
          if (childTableDocTypes.includes(doc.name) && doc.fields) {
            doc.fields.forEach((childField: any) => {
              // Map fieldname -> { doctype: "Child Table", fieldname: "fieldname" }
              // But to avoid collisions, key is the fieldname only (Frappe looks up by fieldname)
              if (!map[childField.fieldname]) {
                map[childField.fieldname] = {
                  doctype: doc.name,
                  fieldname: childField.fieldname,
                };
              }
            });
          }
        });
      }
      return map;
    },
    [schemaData],
  );

  useEffect(() => {
    if (schemaError) {
      setError("Failed to load schema");
      setMetaLoaded(true);
      return;
    }
    if (schemaData?.message?.docs?.length || schemaData?.docs?.length) {
      const docs = schemaData.message?.docs ?? schemaData.docs ?? [];
      const meta = docs.find((d: any) => d.name === doctype) ?? docs[0];
      if (meta) {
        const fields = meta.fields ?? [];
        setSchemaFields(fields);
        setIsSubmittable(meta.is_submittable === 1);

        // Build child table field map
        const cfMap = buildChildTableFieldMap(fields);
        setChildTableFields(cfMap);

        // Check if a field is valid: directly on doctype or in a child table
        const isValidField = (fieldname: string): boolean => {
          if (
            [
              "name",
              "docstatus",
              "owner",
              "creation",
              "modified",
              "modified_by",
              "_user_tags",
              "_comments",
              "_assign",
              "_liked_by",
              "idx",
            ].includes(fieldname)
          )
            return true;
          if (fields.some((f: any) => f.fieldname === fieldname)) return true;
          if (cfMap[fieldname]) return true;
          return false;
        };

        // Convert a route_options field key to proper filter key
        // If it's a child table field, convert to "Child Table.fieldname" format
        const getFilterKey = (fieldname: string): string | null => {
          if (fieldname.includes(".")) return fieldname; // Already in dot notation
          if (fields.some((f: any) => f.fieldname === fieldname))
            return fieldname; // Direct field
          if (cfMap[fieldname])
            return `${cfMap[fieldname].doctype}.${fieldname}`; // Child table field
          return null; // Invalid field
        };

        // Build initial filters from route_options (location state + URL params)
        const initial: Record<string, ActiveFilter> = {};
        const allRouteOpts: Record<string, string> = {};

        // Priority 1: location state routeOptions (set programmatically via ConnectionDashboard etc.)
        const stateRouteOptions = (location.state as any)?.routeOptions;
        if (stateRouteOptions && typeof stateRouteOptions === "object") {
          for (const [key, value] of Object.entries(stateRouteOptions)) {
            allRouteOpts[key] = String(value ?? "");
          }
        }

        // Priority 2: URL search params
        for (const [key, val] of searchParams.entries()) {
          allRouteOpts[key] = val;
        }

        const seenKeys = new Set<string>();
        for (const [key, val] of Object.entries(allRouteOpts)) {
          if (["page", "sort", "order", "ps"].includes(key)) continue;

          // Validate the field - skip if not a valid field anywhere
          const fieldPart = key.includes(".") ? key.split(".")[1] : key;
          if (!isValidField(fieldPart)) continue;

          // Get proper filter key (auto-convert to child table dot notation)
          const filterKey = getFilterKey(fieldPart);
          if (!filterKey) continue;

          seenKeys.add(filterKey);
          if (
            filterKey === "name" ||
            (filterKey.includes(".") && fieldPart === "name")
          ) {
            initial[filterKey] = {
              value: val,
              operator: "like",
              fieldtype: "Data",
            };
          } else if (fieldPart === "docstatus") {
            initial.docstatus = {
              value: val,
              operator: "=",
              fieldtype: "Select",
            };
          } else {
            // Find the field def from either parent or child table
            const fc = fields.find((f: any) => f.fieldname === fieldPart);
            initial[filterKey] = {
              value: val,
              operator:
                fc?.fieldtype === "Select" || fc?.fieldtype === "Link"
                  ? "="
                  : "like",
              fieldtype: fc?.fieldtype || "Data",
            };
          }
        }
        // Ensure name filter exists
        if (
          !initial.name &&
          !Object.keys(initial).some(
            (k) => k === "name" || (k.includes(".") && k.endsWith(".name")),
          )
        ) {
          initial.name = { value: "", operator: "like", fieldtype: "Data" };
        }
        setActiveFilters(initial);
      }
      setMetaLoaded(true);
    }
  }, [
    schemaData,
    schemaError,
    doctype,
    location.state,
    buildChildTableFieldMap,
  ]);

  const filterableFields = useMemo(
    () =>
      schemaFields.filter(
        (f: any) =>
          ![
            "Tab Break",
            "Section Break",
            "Column Break",
            "Fold",
            "Page Break",
          ].includes(f.fieldtype) && !f.hidden,
      ),
    [schemaFields],
  );

  const frappeFilters = useMemo(() => {
    const f: any[] = [];
    Object.entries(activeFilters).forEach(([key, af]) => {
      if (!af.value) return;
      let op = af.operator;
      let val: any = af.value;

      // --- Handle dot notation for child table fields ---
      // e.g. "Sales Invoice Item.item_code" => doctype = "Sales Invoice Item", field = "item_code"
      let filterDoctype = doctype;
      let fieldKey = key;
      if (key.includes(".")) {
        filterDoctype = key.split(".")[0];
        fieldKey = key.split(".")[1];
      }

      // --- Handle comma-separated list for "in" operator ---
      // e.g. ?name=DOC-001,DOC-002
      if (
        fieldKey === "name" &&
        typeof val === "string" &&
        val.includes(",") &&
        !val.includes("%")
      ) {
        const names = val
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean);
        if (names.length > 1) {
          f.push([filterDoctype, "name", "in", names]);
          return;
        }
      }

      // --- Handle array values: e.g. `{ "modified": [">=", "2023-01-01"] }` ---
      if (typeof val === "string") {
        // Try to parse JSON string from URL params
        if (val.startsWith("[") && val.endsWith("]")) {
          try {
            const parsed = JSON.parse(val);
            if (Array.isArray(parsed)) {
              // Nested array: e.g. [["=", "A"], ["=", "B"]]
              if (Array.isArray(parsed[0])) {
                parsed.forEach((inner: any) => {
                  f.push([filterDoctype, fieldKey, inner[0], inner[1]]);
                });
                return;
              }
              // Simple array: e.g. [">=", "2023-01-01"] => operator from value[0], value from value[1]
              if (parsed.length === 2) {
                f.push([filterDoctype, fieldKey, parsed[0], parsed[1]]);
                return;
              }
            }
          } catch {
            // Not valid JSON, treat as string
          }
        }
      }

      // --- Standard filter handling ---
      if (op === "like" && typeof val === "string" && !val.includes("%"))
        val = `%${val}%`;
      if (op === "__starts_with") {
        op = "like";
        val = `${val}%`;
      }
      if (op === "__ends_with") {
        op = "like";
        val = `%${val}`;
      }

      f.push([filterDoctype, fieldKey, op, val]);
    });

    // Add liked filter if showLikedOnly is active
    if (showLikedOnly && user?.name) {
      f.push([doctype, "_liked_by", "like", `%${user.name}%`]);
    }

    return f;
  }, [activeFilters, doctype, showLikedOnly, user]);

  const { data: countData, mutate: refetchCount } = useFrappeGetCall(
    "frappe.desk.reportview.get_count",
    {
      doctype,
      filters: JSON.stringify(frappeFilters),
      fields: JSON.stringify([]),
      distinct: false,
    },
    doctype && metaLoaded
      ? `dtl-cnt-${doctype}-${JSON.stringify(frappeFilters)}`
      : null,
  );

  const {
    call: fetchList,
    result: listResult,
    loading: listLoading,
  } = useFrappePostCall("frappe.desk.reportview.get");

  const standardFilterFields = useMemo(
    () =>
      schemaFields.filter(
        (f: any) =>
          f.in_standard_filter === 1 &&
          f.fieldname !== "name" &&
          !["Tab Break", "Section Break", "Column Break"].includes(f.fieldtype),
      ),
    [schemaFields],
  );

  useEffect(() => {
    if (!metaLoaded || !schemaFields.length || typeof fetchList !== "function")
      return;
    const fields = new Set(
      schemaFields
        .filter((f: any) => f.in_list_view)
        .map((f: any) => f.fieldname),
    );
    fields.add("name");
    fields.add("creation");
    fields.add("modified");
    fields.add("owner");
    fields.add("_user_tags");
    fields.add("_comments");
    fields.add("_assign");
    fields.add("_liked_by");
    fields.add("idx");
    if (isSubmittable) fields.add("docstatus");
    setIsLoading(true);
    fetchList({
      doctype,
      fields: Array.from(fields).map((f) => `\`tab${doctype}\`.\`${f}\``),
      filters: frappeFilters,
      order_by: `\`tab${doctype}\`.\`${sortField}\` ${sortOrder}`,
      start: (currentPage - 1) * pageSize,
      page_length: pageSize || 999999,
      view: "List",
      with_comment_count: 1,
    });
  }, [
    metaLoaded,
    schemaFields,
    doctype,
    currentPage,
    pageSize,
    frappeFilters,
    sortField,
    sortOrder,
    isSubmittable,
    fetchList,
  ]);

  useEffect(() => {
    if (listResult?.message) {
      const { keys, values } = listResult.message;
      setRows(
        keys && Array.isArray(values)
          ? values.map((row: any[]) =>
              keys.reduce((acc: any, key: string, i: number) => {
                acc[key] = row[i];
                return acc;
              }, {}),
            )
          : [],
      );
    }
    setIsLoading(false);
  }, [listResult]);

  useEffect(() => {
    if (countData?.message !== undefined) {
      const total = countData.message || 0;
      setTotalCount(total);
    }
  }, [countData]);

  // If total count is 0 and we're on a page > 1, reset to page 1
  useEffect(() => {
    if (totalCount === 0 && currentPage > 1 && metaLoaded) {
      const params = new URLSearchParams(searchParams);
      params.set("page", "1");
      setSearchParams(params, { replace: true });
    }
  }, [totalCount, currentPage, metaLoaded]);
  useEffect(() => {
    if (error) setIsLoading(false);
  }, [error]);

  const listColumns = useMemo(() => {
    const cols: AppListColumn[] = [
      { fieldname: "name", label: "ID", fieldtype: "Data" },
    ];
    schemaFields
      .filter((f: any) => f.in_list_view && f.fieldname !== "name")
      .forEach((f: any) =>
        cols.push({
          fieldname: f.fieldname,
          label: f.label || f.fieldname,
          fieldtype: f.fieldtype,
        }),
      );
    if (isSubmittable)
      cols.push({
        fieldname: "docstatus",
        label: "Status",
        fieldtype: "Select",
      });
    cols.push(...extraColumns);
    return cols;
  }, [schemaFields, isSubmittable, extraColumns]);

  const columnDefs = useMemo<ColumnDef<any>[]>(() => {
    const defs: ColumnDef<any>[] = [
      {
        id: "_select",
        header: () => (
          <Checkbox
            checked={
              rows.length > 0 && rows.every((r) => selectedNames.has(r.name))
            }
            data-state={
              selectedNames.size > 0 &&
              !(rows.length > 0 && rows.every((r) => selectedNames.has(r.name)))
                ? "indeterminate"
                : "unchecked"
            }
            onCheckedChange={() =>
              setSelectedNames(
                selectedNames.size === rows.length
                  ? new Set()
                  : new Set(rows.map((r) => r.name)),
              )
            }
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={selectedNames.has(row.original.name)}
            onCheckedChange={() => {
              setSelectedNames((prev) => {
                const n = new Set(prev);
                if (n.has(row.original.name)) n.delete(row.original.name);
                else n.add(row.original.name);
                return n;
              });
            }}
          />
        ),
        size: 40,
        enableResizing: false,
      },
    ];
    listColumns.forEach((col) =>
      defs.push({
        id: col.fieldname,
        header: () => (
          <div className="flex items-center gap-1.5">
            <span>{col.label}</span>
            <ArrowUpDown className="h-3 w-3 text-muted-foreground/40" />
          </div>
        ),
        accessorKey: col.fieldname,
        cell: ({ getValue }) => {
          const val: any = getValue();
          if (col.fieldname === "docstatus") {
            const s = DOCSTATUS_MAP[val] ?? {
              label: String(val),
              variant: "outline" as const,
            };
            return <Badge variant={s.variant as any}>{s.label}</Badge>;
          }
          return (
            <span
              className={cn(
                "text-sm",
                col.fieldname === "name" && "font-medium",
              )}
            >
              {formatCellValue(val, col.fieldtype)}
            </span>
          );
        },
        size: col.width,
      }),
    );
    defs.push({
      id: "_modified",
      header: () => null,
      accessorKey: "modified",
      cell: ({ getValue }) => (
        <div
          className="flex items-center justify-center"
          title={new Date(getValue() as string).toLocaleString()}
        >
          <Clock className="!ml-6 h-3 w-3 text-muted-foreground/60" />
          <span className="text-[10px] text-muted-foreground ml-0.5 tabular-nums">
            {timeAgo(getValue() as string)}
          </span>
        </div>
      ),
      size: 56,
      enableResizing: false,
    });
    defs.push({
      id: "_comments",
      header: () => null,
      accessorKey: "_comment_count",
      cell: ({ row }) => {
        const c = (row.original as any)._comment_count;
        const n = typeof c === "number" ? c : parseInt(c, 10) || 0;
        return (
          <div
            className="flex items-center justify-center gap-0.5"
            title={`${n} comment${n !== 1 ? "s" : ""}`}
          >
            <svg
              className="h-3 w-3 text-muted-foreground/60"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {n}
            </span>
          </div>
        );
      },
      size: 36,
      enableResizing: false,
    });
    defs.push({
      id: "_liked",
      header: () => (
        <button
          type="button"
          onClick={() => setShowLikedOnly((p) => !p)}
          className={cn(
            "flex items-center justify-center w-full h-full cursor-pointer transition-colors rounded-sm",
            showLikedOnly
              ? "text-red-500"
              : "text-muted-foreground/40 hover:text-red-400",
          )}
          title={showLikedOnly ? "Show all" : "Show liked only"}
        >
          <svg
            className={cn("h-3.5 w-3.5", showLikedOnly ? "fill-current" : "")}
            viewBox="0 0 24 24"
            fill={showLikedOnly ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
          </svg>
        </button>
      ),
      accessorKey: "_liked_by",
      cell: ({ row }) => {
        const lb = (row.original as any)._liked_by;
        const liked =
          lb && typeof lb === "string" && lb.includes(user?.name || "");
        const name = (row.original as any).name;
        return (
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  const res = await fetch(
                    `/api/method/frappe.desk.like.toggle_like`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        doctype,
                        name,
                        add: !liked ? "Yes" : "No",
                      }),
                    },
                  );
                  if (res.ok) {
                    // Refresh the list
                    refetchCount();
                    fetchList({
                      doctype,
                      fields: Array.from(
                        new Set(
                          schemaFields
                            .filter((f: any) => f.in_list_view)
                            .map((f: any) => f.fieldname),
                        ),
                      )
                        .map((f) => `\`tab${doctype}\`.\`${f}\``)
                        .concat(
                          [
                            "name",
                            "creation",
                            "modified",
                            "owner",
                            "_user_tags",
                            "_comments",
                            "_assign",
                            "_liked_by",
                            "idx",
                          ].map((f) => `\`tab${doctype}\`.\`${f}\``),
                        ),
                      filters: frappeFilters,
                      order_by: `\`tab${doctype}\`.\`${sortField}\` ${sortOrder}`,
                      start: (currentPage - 1) * pageSize,
                      page_length: pageSize || 999999,
                      view: "List",
                      with_comment_count: 1,
                    });
                  }
                } catch {}
              }}
              className={cn(
                "cursor-pointer transition-colors p-0.5 rounded hover:bg-muted",
                liked
                  ? "text-red-500 hover:text-red-600"
                  : "text-muted-foreground/40 hover:text-red-400",
              )}
              title={liked ? "Unlike" : "Like"}
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill={liked ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
              </svg>
            </button>
          </div>
        );
      },
      size: 36,
      enableResizing: false,
    });
    return defs;
  }, [listColumns, selectedNames, rows, user]);

  const table = useReactTable({
    data: rows,
    columns: columnDefs,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });
  const totalPages =
    pageSize === 0 ? 1 : Math.max(1, Math.ceil(totalCount / pageSize));

  const handleFilterChange = (fn: string, op: string, v: string) =>
    setActiveFilters((p) => ({
      ...p,
      [fn]: {
        ...(p[fn] || { operator: "like", fieldtype: "Data" }),
        operator: op,
        value: v,
      },
    }));
  const removeFilter = (fn: string) =>
    setActiveFilters((p) => {
      const n = { ...p };
      delete n[fn];
      return n;
    });
  const clearFilters = () => {
    setActiveFilters({
      name: { value: "", operator: "like", fieldtype: "Data" },
    });
    setFilterRows([]);
  };
  const applyFilters = () => {
    const newActive: Record<string, ActiveFilter> = {};
    filterRows.forEach((pf) => {
      if (pf.fieldname && pf.value) {
        newActive[pf.fieldname] = {
          value: pf.value,
          operator: pf.operator,
          fieldtype: pf.fieldtype,
        };
      }
    });
    if (Object.keys(newActive).length > 0) {
      setActiveFilters((prev) => ({ ...prev, ...newActive }));
    }
    setFilterRows([]);
  };

  // Populate filterRows with active filters when dropdown opens
  useEffect(() => {
    if (filterDropdownOpen && filterRows.length === 0) {
      const rows: FilterItem[] = [];
      Object.entries(activeFilters).forEach(([key, af]) => {
        if (key === "name" || !af.value) return;
        rows.push({
          fieldname: key,
          operator: af.operator,
          value: af.value,
          fieldtype: af.fieldtype,
        });
      });
      if (rows.length > 0) {
        setFilterRows(rows);
      }
    }
  }, [filterDropdownOpen, activeFilters, filterRows.length]);

  const applyQuickDate = (range: (typeof QUICK_DATE_RANGES)[0]) => {
    const past = new Date(Date.now() - range.minutes * 60 * 1000)
      .toISOString()
      .slice(0, 19);
    setActiveFilters((p) => ({
      ...p,
      modified: { value: past, operator: ">=", fieldtype: "Datetime" },
    }));
  };

  const rowClick = (name: string) => {
    if (onRowNavigate) onRowNavigate(name);
    else navigate(`/app/${doctype.toLowerCase().replace(/ /g, "-")}/${name}`);
  };
  const handleNew = () => {
    // Preserve current route_options as query params for new doc creation
    const params = new URLSearchParams();
    Object.entries(activeFilters).forEach(([key, af]) => {
      if (!af.value || key === "name") return;
      if (af.operator === "=" || af.operator === "like") {
        params.set(key, af.value);
      }
    });
    const qs = params.toString();
    navigate(
      `/app/${doctype.toLowerCase().replace(/ /g, "-")}/new${qs ? `?${qs}` : ""}`,
    );
  };

  const sortableFields = schemaFields
    .filter(
      (f: any) =>
        f.sortable !== 0 &&
        !["Tab Break", "Section Break", "Column Break"].includes(f.fieldtype),
    )
    .map((f: any) => ({ value: f.fieldname, label: f.label || f.fieldname }));
  const filterKeys = Object.keys(activeFilters);
  const hasActiveFilters = filterKeys.some(
    (k) => k !== "name" && activeFilters[k].value !== "",
  );

  const paginationPages = useMemo(() => {
    if (totalPages <= 1) return [];
    const p: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) p.push(i);
    } else if (currentPage <= 4) {
      for (let i = 1; i <= 5; i++) p.push(i);
      p.push("...");
      p.push(totalPages);
    } else if (currentPage >= totalPages - 3) {
      p.push(1);
      p.push("...");
      for (let i = totalPages - 4; i <= totalPages; i++) p.push(i);
    } else {
      p.push(1);
      p.push("...");
      for (let i = currentPage - 1; i <= currentPage + 1; i++) p.push(i);
      p.push("...");
      p.push(totalPages);
    }
    return p;
  }, [totalPages, currentPage]);

  if (userLoading)
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div className="px-4 lg:px-6 space-y-4 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">
            {title || doctype}
          </h1>
          {selectedNames.size > 0 && (
            <Badge variant="secondary" className="text-xs">
              {selectedNames.size} selected
            </Badge>
          )}
          <p className="text-muted-foreground text-sm">
            {totalCount} record{totalCount !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SortDropdown
            open={sortDropdownOpen}
            onOpenChange={setSortDropdownOpen}
            fields={sortableFields}
            sortField={sortField}
            sortOrder={sortOrder}
            onSortFieldChange={setSortField}
            onSortOrderChange={setSortOrder}
          />
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={() => refetchCount()}
            disabled={isLoading || listLoading}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isLoading || listLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <Button size="sm" className="h-8 text-xs gap-1" onClick={handleNew}>
            <Plus className="h-3.5 w-3.5" />
            New
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-md text-sm">
          {error}
        </div>
      )}

      <FilterBar
        standardFilterFields={standardFilterFields}
        activeFilters={activeFilters}
        onFilterChange={handleFilterChange}
        onRemoveFilter={removeFilter}
        onClearFilters={clearFilters}
        filterDropdownOpen={filterDropdownOpen}
        onFilterDropdownOpenChange={setFilterDropdownOpen}
        filterRows={filterRows}
        onSetFilterRows={setFilterRows}
        filterableFields={filterableFields}
        onApplyFilters={applyFilters}
        schemaFields={schemaFields}
      />

      <DataTable
        table={table}
        columns={columnDefs.length}
        isLoading={isLoading || listLoading}
        hasActiveFilters={hasActiveFilters}
        title={title}
        doctype={doctype}
        selectedNames={selectedNames}
        onRowClick={rowClick}
      />

      <PaginationBar
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        currentPage={currentPage}
        totalPages={totalPages}
        totalCount={totalCount}
        onPageChange={(p) =>
          setSearchParams(
            (prev) => {
              const n = new URLSearchParams(prev);
              n.set("page", String(p));
              return n;
            },
            { replace: true },
          )
        }
        onQuickDate={applyQuickDate}
        paginationPages={paginationPages}
      />
    </div>
  );
}

export default DocTypeList;
