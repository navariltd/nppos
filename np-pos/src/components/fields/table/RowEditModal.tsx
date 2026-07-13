"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, ChevronRight } from "lucide-react";
import { FrappeField, type FrappeFieldMeta } from "../FrappeField";
import { buildFormLayout } from "./formLayout";
import type { DoctypeField, FormSection } from "./types";

interface RowEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rowData: Record<string, any>;
  allFields: DoctypeField[];
  onSave: (data: Record<string, any>) => void;
}

/**
 * Normalize a Frappe DocField (with 0/1 booleans) into FrappeFieldMeta (with proper booleans).
 */
function toFrappeFieldMeta(field: DoctypeField): FrappeFieldMeta {
  const meta: FrappeFieldMeta = {
    fieldname: field.fieldname,
    label: field.label,
    fieldtype: field.fieldtype,
    options: field.options,
    default: field.default,
    placeholder: field.placeholder,
    reqd: field.reqd === 1,
    read_only: field.read_only === 1,
    hidden: field.hidden === 1,
    in_list_view: field.in_list_view === 1,
    collapsible: field.collapsible === 1,
    collapsed: field.collapsed === 1,
    depends_on: field.depends_on,
    description: field.description,
    bold: field.bold === 1,
    allow_on_submit: field.allow_on_submit === 1,
    unique: field.unique === 1,
    no_copy: field.no_copy === 1,
    permlevel: field.permlevel,
    translatable: field.translatable === 1,
    hide_days: field.hide_days === 1,
    hide_seconds: field.hide_seconds === 1,
    non_negative: field.non_negative === 1,
    allow_in_quick_entry: field.allow_in_quick_entry === 1,
    search_index: field.search_index === 1,
    in_global_search: field.in_global_search === 1,
    in_filter: field.in_filter === 1,
    in_preview: field.in_preview === 1,
    in_standard_filter: field.in_standard_filter === 1,
    allow_bulk_edit: field.allow_bulk_edit === 1,
    print_hide: field.print_hide === 1,
    print_hide_if_no_value: field.print_hide_if_no_value === 1,
    max_height: field.max_height,
    precision: field.precision,
    length: field.length,
    regex: field.regex,
    max_value: field.max_value,
    min_value: field.min_value,
    max_length: field.max_length,
    min_length: field.min_length,
    fetch_from: field.fetch_from,
    remember_last_used_value: field.remember_last_selected_value === 1,
    sortable: field.sortable === 1,
  };
  // Copy over numeric 'columns' as number only if defined
  if (field.columns !== undefined) {
    meta.columns = field.columns;
  }
  return meta;
}

export const RowEditModal = ({
  open,
  onOpenChange,
  rowData,
  allFields,
  onSave,
}: RowEditModalProps) => {
  const [editData, setEditData] = React.useState<Record<string, any>>({});

  React.useEffect(() => {
    if (open) {
      setEditData({ ...rowData });
    }
  }, [open, rowData]);

  const handleFieldChange = (fieldname: string, val: any) => {
    setEditData((prev) => ({ ...prev, [fieldname]: val }));
  };

  const handleSave = () => {
    onSave(editData);
    onOpenChange(false);
  };

  const tabs = React.useMemo(() => buildFormLayout(allFields), [allFields]);

  // Track collapsed state for collapsible sections
  const [collapsedSections, setCollapsedSections] = React.useState<
    Record<string, boolean>
  >({});

  React.useEffect(() => {
    if (open) {
      const initial: Record<string, boolean> = {};
      allFields.forEach((f) => {
        if (f.fieldtype === "Section Break" && f.collapsible === 1) {
          // If collapsible, default to collapsed (true) unless explicitly set to 0
          initial[f.label || f.fieldname || `section_${f.idx}`] =
            f.collapsed !== 0;
        }
      });
      setCollapsedSections(initial);
    }
  }, [open, allFields]);

  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderFormFields = (fields: DoctypeField[]) => {
    return fields.map((field) => {
      const ft = field.fieldtype;
      if (
        ["Tab Break", "Section Break", "Column Break", "Heading", "Fold"].includes(ft)
      )
        return null;
      // Skip hidden fields
      if (field.hidden === 1) return null;
      // For read_only, just show read-only
      const meta = toFrappeFieldMeta(field);
      return (
        <FrappeField
          key={field.fieldname}
          field={meta}
          value={editData[field.fieldname]}
          onChange={(val: any) => handleFieldChange(field.fieldname, val)}
          showLabel
        />
      );
    });
  };

  const renderSections = (sections: FormSection[]) => {
    return sections.map((section, si) => {
      const sectionKey = section.label || `section_${si}`;
      const isCollapsed = collapsedSections[sectionKey] ?? false;

      return (
        <div key={si} className="mb-6 last:mb-0">
          {section.label && (
            <div className="flex items-center gap-2 mb-3 pb-1 border-b border-border">
              {section.collapsible ? (
                <button
                  type="button"
                  onClick={() => toggleSection(sectionKey)}
                  className="flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary transition-colors"
                >
                  {isCollapsed ? (
                    <ChevronRight className="size-4" />
                  ) : (
                    <ChevronDown className="size-4" />
                  )}
                  {section.label}
                </button>
              ) : (
                <h4 className="text-sm font-semibold text-foreground">
                  {section.label}
                </h4>
              )}
            </div>
          )}
          {(!section.collapsible || !isCollapsed) && (
            <div
              className={cn("grid gap-4", "grid-cols-1")}
              style={
                section.columns.length > 1
                  ? ({
                      gridTemplateColumns: `repeat(${Math.min(
                        section.columns.length,
                        3,
                      )}, 1fr)`,
                    } as React.CSSProperties)
                  : undefined
              }
            >
              {section.columns.map((col, ci) => (
                <div key={ci} className="flex flex-col gap-3">
                  {renderFormFields(col.fields)}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <style>{`
        [data-slot="dialog-overlay"] {
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
        }
      `}</style>
      <DialogContent className="sm:max-w-3xl lg:max-w-4xl max-h-[90vh] overflow-y-auto border-primary/20 shadow-2xl">
        <DialogHeader>
          <DialogTitle>Edit Row</DialogTitle>
        </DialogHeader>

        {tabs.length > 1 ? (
          <Tabs defaultValue={tabs[0]?.label || "Default"} className="w-full">
            <TabsList className="mb-4 flex-wrap">
              {tabs.map((tab) => (
                <TabsTrigger key={tab.label} value={tab.label}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {tabs.map((tab) => (
              <TabsContent key={tab.label} value={tab.label}>
                {renderSections(tab.sections)}
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <div className="space-y-6">
            {tabs[0] && renderSections(tabs[0].sections)}
          </div>
        )}

        <DialogFooter className="mt-6 pt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};