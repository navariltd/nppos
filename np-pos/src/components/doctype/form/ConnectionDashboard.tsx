"use client";

import { motion } from "framer-motion";
import { useFrappeGetCall } from "frappe-react-sdk";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ConnectionDashboardProps {
  doctype: string;
  docname?: string;
  metaConfig?: any;
}

export function ConnectionDashboard({
  doctype,
  docname,
  metaConfig,
}: ConnectionDashboardProps) {
  const navigate = useNavigate();
  const dashboardMeta = metaConfig?.__dashboard || {};
  const {
    fieldname = "customer",
    non_standard_fieldnames = {},
    transactions = [],
    internal_links = {},
    dynamic_links = {},
  } = dashboardMeta;

  // 1. Gather all trackable doctypes across active groups (Lazy fetch optimization array payload)
  const trackableItems = transactions.reduce((acc: string[], group: any) => {
    if (group?.items) {
      acc.push(...group.items);
    }
    return acc;
  }, []);

  const hasDoc = !!(doctype && docname && trackableItems.length > 0);

  // 2. Fetch runtime link counters mirroring frappe.desk.notifications.get_open_count
  const { data: notificationData } = useFrappeGetCall(
    hasDoc ? "frappe.desk.notifications.get_open_count" : null,
    hasDoc
      ? {
          doctype: doctype,
          name: docname!,
          items: trackableItems,
        }
      : null,
    hasDoc
      ? `conn-dash-${doctype}-${docname}-${trackableItems.join(",")}`
      : null,
  );

  const countData = notificationData?.message?.count || {};
  const externalLinks: any[] = countData?.external_links_found || [];
  const internalLinks: any[] = countData?.internal_links_found || [];
  const combinedLinks = [...externalLinks, ...internalLinks];

  if (combinedLinks.length === 0) return null;

  const linkMap = new Map(
    combinedLinks.map((link: any) => [link.doctype, link]),
  );

  const toSlug = (dt: string) => dt.toLowerCase().replace(/ /g, "-");

  // Build route_options for a target doctype (Frappe pattern)
  // For list filtering: keep full dot notation for child table fields (e.g. "Child Table.fieldname")
  // For new doc prefill: use plain fieldname only
  const getRouteOptions = (targetDoctype: string, isNew = false) => {
    const opts: Record<string, string> = {};
    if (!docname) return opts;

    const linkField = non_standard_fieldnames[targetDoctype] || fieldname;

    if (dynamic_links && dynamic_links[linkField]) {
      const [refDoctypeValue, refDoctypeField] = dynamic_links[linkField];
      opts[linkField] = docname;
      opts[refDoctypeField] = refDoctypeValue;
    } else if (isNew || !linkField.includes(".")) {
      // For new doc or simple fields: use clean fieldname
      const cleanField = linkField.includes(".")
        ? linkField.split(".")[1]
        : linkField;
      opts[cleanField] = docname;
    } else {
      // For list filtering with child table fields: keep full dot notation
      opts[linkField] = docname;
    }
    return opts;
  };

  // Navigate to list view with route_options (Frappe pattern: set route_options, then navigate)
  const handleNavigateToList = (targetDoctype: string) => {
    const slug = toSlug(targetDoctype);
    const matchedLinkData = linkMap.get(targetDoctype);

    // Internal child links with explicit record collections
    if (matchedLinkData?.names && matchedLinkData.names.length > 0) {
      navigate(`/app/${slug}`, {
        state: { routeOptions: { name: matchedLinkData.names.join(",") } },
      });
      return;
    }

    navigate(`/app/${slug}`, {
      state: { routeOptions: getRouteOptions(targetDoctype) },
    });
  };

  // Navigate to new doc with route_options for prefilling (Frappe pattern)
  const handleNavigateToNew = (targetDoctype: string) => {
    const slug = toSlug(targetDoctype);
    navigate(`/app/${slug}/new`, {
      state: { routeOptions: getRouteOptions(targetDoctype, true) },
    });
  };

  // Only render active transaction groups populated in the count state matrix
  const activeSections = transactions.filter((section: any) =>
    section.items.some((item: string) => linkMap.has(item)),
  );

  if (activeSections.length === 0) return null;

  return (
    <motion.div
      className="p-4 bg-muted/30 rounded-lg border"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {activeSections.map((section: any) => {
          const visibleItems = section.items.filter((item: string) =>
            linkMap.has(item),
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.label} className="flex flex-col gap-2">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">
                {section.label}
              </h3>
              <div className="flex flex-col gap-1.5">
                {visibleItems.map((item: string) => {
                  const link = linkMap.get(item);
                  const hasCount = link.count > 0 || link.open_count > 0;
                  const isLinkDisabled =
                    internal_links[item] &&
                    (!link.names || link.names.length === 0);

                  return (
                    <div
                      key={link.doctype}
                      className={`group flex items-center justify-between p-2 rounded-lg border transition-all text-xs h-9 ${
                        hasCount
                          ? "bg-card border-border shadow-sm hover:border-primary/30 hover:shadow-md"
                          : "bg-muted/40 border-border/60 hover:bg-card hover:border-primary/30 hover:shadow-md"
                      } ${isLinkDisabled ? "opacity-60 pointer-events-none" : ""}`}
                    >
                      <button
                        onClick={() => {
                          if (!isLinkDisabled) handleNavigateToList(link.doctype);
                        }}
                        className={`font-medium truncate transition-colors max-w-[70%] block text-left bg-transparent border-none cursor-pointer ${
                          isLinkDisabled
                            ? "text-muted-foreground cursor-not-allowed"
                            : "text-foreground hover:text-primary"
                        }`}
                      >
                        {link.doctype}
                      </button>
                      <div className="flex items-center gap-1.5 ml-2 shrink-0">
                        <span
                          className={`font-semibold ${
                            hasCount
                              ? "text-foreground"
                              : "text-muted-foreground"
                          }`}
                        >
                          {link.count || 0}
                        </span>
                        {link.open_count > 0 && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold text-white bg-destructive rounded-full min-w-4 text-center">
                            {link.open_count > 99 ? "99+" : link.open_count}
                          </span>
                        )}
                        <button
                          onClick={() => handleNavigateToNew(link.doctype)}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors bg-transparent border-none cursor-pointer"
                          title={`Create new ${link.doctype}`}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

export default ConnectionDashboard;