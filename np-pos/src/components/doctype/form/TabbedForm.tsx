/**
 * TabbedForm – tabbed document detail with sections, sidebar, activity, and connections.
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FrappeFieldMeta, TabConfig } from "../types";
import { buildTabs } from "../utils";
import { FormSection } from "./FormSection";
import { ConnectionDashboard } from "./ConnectionDashboard";
import { DocumentActivity } from "./DocumentActivity";
import { DocumentSidebar } from "./DocumentSidebar";

interface TabbedFormProps {
  schemaFields: FrappeFieldMeta[];
  form: Record<string, any>;
  docData?: any;
  doctype: string;
  isReadOnly: boolean;
  isNew: boolean;
  isLoadingDoc: boolean;
  onFieldChange: (value: any, fieldname?: string) => void;
  collapsedSections: Record<string, boolean>;
  onToggleSection: (fieldname: string) => void;
  metaConfig?: any;
  reloadData?: () => void;
}

export function TabbedForm({
  schemaFields,
  form,
  docData,
  doctype,
  isReadOnly,
  isNew,
  isLoadingDoc,
  onFieldChange,
  collapsedSections,
  onToggleSection,
  metaConfig,
  reloadData,
}: TabbedFormProps) {
  const [tabs, setTabs] = useState<TabConfig[]>([]);
  const [selectedTab, setSelectedTab] = useState<TabConfig | null>(null);
  const [tabFields, setTabFields] = useState<any[]>([]);

  const effectiveReload = reloadData || (() => {});

  // Use replaceState to avoid hash changes causing page reloads
  const setTabHash = useCallback((tab: TabConfig) => {
    const hash = tab.fieldname || tab.label?.toLowerCase() || "";
    window.history.replaceState(null, "", `#${hash}`);
  }, []);

  // Default to the first tab (index 0) - this is the primary content tab
  const firstContentTab = useCallback((tabs: TabConfig[]) => {
    return tabs[0] || null;
  }, []);

  useEffect(() => {
    if (!schemaFields || schemaFields.length === 0) return;
    const built = buildTabs(schemaFields);
    setTabs(built);

    const hash = window.location.hash.replace("#", "");
    if (hash && built.length > 0) {
      const matchedTab = built.find(
        (t) => (t.fieldname || t.label?.toLowerCase()) === hash,
      );
      if (matchedTab) {
        setSelectedTab(matchedTab);
      } else {
        const defaultTab = firstContentTab(built);
        setSelectedTab(defaultTab);
        setTabHash(defaultTab);
      }
    } else if (built.length > 0) {
      const defaultTab = firstContentTab(built);
      setSelectedTab(defaultTab);
      setTabHash(defaultTab);
    }
  }, [schemaFields, setTabHash, firstContentTab]);

  useEffect(() => {
    if (!selectedTab || !tabs.length) return;
    const found = tabs.find((t) => t.fieldname === selectedTab.fieldname);
    if (found) setTabFields(found.sections);
  }, [selectedTab, tabs]);

  const handleTabClick = (tab: TabConfig) => {
    setSelectedTab(tab);
    setTabHash(tab);
  };

  // In read-only mode, filter out tabs that have no visible sections/form fields with values
  const visibleTabs = useMemo(() => {
    if (!isReadOnly || tabs.length === 0) return tabs;
    return tabs.filter((tab) => {
      // Always show dashboard tab if it has show_dashboard
      if ((tab as any).show_dashboard === 1) return true;
      // Check if any section in this tab has visible fields with values
      return tab.sections.some((section) => {
        return section.columns.some((col) => {
          return col.fields.some((field) => {
            if (field.hidden) return false;
            const value = form[field.fieldname];
            return value !== undefined && value !== null && value !== "" && value !== 0 && value !== false;
          });
        });
      });
    });
  }, [tabs, isReadOnly, form]);

  // If currently selected tab got filtered out, switch to first visible tab
  useEffect(() => {
    if (isReadOnly && visibleTabs.length > 0 && selectedTab) {
      const stillVisible = visibleTabs.find((t) => t.fieldname === selectedTab.fieldname);
      if (!stillVisible) {
        setSelectedTab(visibleTabs[0]);
      }
    }
  }, [visibleTabs, selectedTab, isReadOnly]);

  // When there are no Tab Breaks, render fields directly without tabs
  if (tabs.length === 0) {
    if (isLoadingDoc && !isNew) {
      return (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      );
    }
    return (
      <div className="flex flex-col lg:flex-row gap-0">
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1 min-h-0 px-4 py-4">
            <div className="flex flex-col gap-4">
              <div className="flex-1 min-w-0 flex flex-col">
                <div className="space-y-3">
                  {schemaFields.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">No fields configured for this doctype.</div>
                  ) : (
                    schemaFields.map((field) => (
                      <FormSection
                        key={field.fieldname}
                        section={{
                          label: "",
                          fieldname: "single_section",
                          collapsible: false,
                          collapsed: false,
                          columns: [{ label: "", fieldname: "single_col", fields: [field] }],
                        }}
                        form={form}
                        doctype={doctype}
                        isReadOnly={isReadOnly}
                        isNew={isNew}
                        onFieldChange={onFieldChange}
                        isCollapsed={false}
                        onToggleSection={() => {}}
                      />
                    ))
                  )}
                </div>
                {!isNew && <DocumentActivity form={form} docData={docData} />}
              </div>
            </div>
          </div>
        </div>
        {!isNew && (
          <DocumentSidebar form={form} docData={docData} metaConfig={metaConfig} reloadData={effectiveReload} />
        )}
      </div>
    );
  }

  if (isLoadingDoc && !isNew) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  const isDashboardTab = (selectedTab as any)?.show_dashboard === 1;
  const hasVisibleContent = visibleTabs.length > 0;

  if (isReadOnly && !hasVisibleContent) {
    return (
      <div className="flex flex-col lg:flex-row gap-0">
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex-1 min-h-0 px-4 py-4">
            <div className="text-center py-12 text-muted-foreground text-sm">
              No data to display.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-0">
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Tab Bar */}
        <div className="flex-shrink-0">
          <div className="relative flex items-center justify-between px-4 pt-2 bg-muted/30 border-b rounded-t-lg">
            <ul className="flex pt-2 gap-x-6 list-none bg-transparent">
              {visibleTabs.map((tab, index) => (
                <li key={tab.fieldname || index} className="cursor-pointer">
                  <button
                    onClick={() => handleTabClick(tab)}
                    className={`flex items-center font-medium text-sm pb-2 px-1 transition-colors ${
                      selectedTab?.fieldname === tab.fieldname
                        ? "border-b-2 border-primary text-primary"
                        : "text-muted-foreground hover:text-foreground border-b-2 border-transparent"
                    }`}
                  >
                    {tab.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 min-h-0 px-4 py-4">
          <div className="flex flex-col gap-4">
            <div className="flex-1 min-w-0 flex flex-col">
              <div>
                {/* Render sections for selected tab */}
                {tabFields.length === 0 ? (
                  <></>
                ) : (
                  tabFields.map((section: any, index: number) => (
                    <div key={section.fieldname || index} className="mb-4">
                      <FormSection
                        section={section}
                        form={form}
                        doctype={doctype}
                        isReadOnly={isReadOnly}
                        isNew={isNew}
                        onFieldChange={onFieldChange}
                        isCollapsed={
                          collapsedSections[section.fieldname] ??
                          section.collapsed
                        }
                        onToggleSection={onToggleSection}
                      />
                    </div>
                  ))
                )}

                {/* Dashboard tab content for tabs with show_dashboard */}
                {isDashboardTab && !isNew && form?.name && (
                  <ConnectionDashboard
                    doctype={doctype}
                    docname={form.name}
                    metaConfig={metaConfig}
                  />
                )}
              </div>

              {/* Document activity for existing documents */}
              {!isNew && <DocumentActivity form={form} docData={docData} />}
            </div>
          </div>
        </div>
      </div>

      {/* Sidebar for existing documents */}
      {!isNew && (
        <DocumentSidebar
          form={form}
          docData={docData}
          metaConfig={metaConfig}
          reloadData={effectiveReload}
        />
      )}
    </div>
  );
}

export default TabbedForm;