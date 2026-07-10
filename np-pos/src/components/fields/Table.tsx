"use client";

import { callPost } from "@/lib/frappe-service";
import { cn } from "@/lib/utils";
import { Loader2, Plus, Trash2 } from "lucide-react";
import * as React from "react";

import { Autocomplete } from "./AutoComplete";
import { Barcode } from "./Barcode";
import { ButtonField } from "./Button";
import { Check } from "./Check";
import { Code } from "./Code";
import { Color } from "./Color";
import { Currency } from "./Currency";
import { Data } from "./Data";
import { Date } from "./Date";
import { Datetime } from "./Datetime";
import { Duration } from "./Duration";
import { DynamicLink } from "./DynamicLink";
import { Float } from "./Float";
import { Geolocation } from "./Geolocation";
import { Icon } from "./Icon";
import { Image } from "./Image";
import { Int } from "./Int";
import { JSON as JSONField } from "./JSON";
import { LinkField } from "./LinkField";
import { LongText } from "./LongText";
import { MarkdownEditor } from "./MarkdownEditor";
import { Password } from "./Password";
import { Percent } from "./Percent";
import { Phone } from "./Phone";
import { Rating } from "./Rating";
import { ReadOnly } from "./ReadOnly";
import { Select } from "./Select";
import { Signature } from "./Signature";
import { SmallText } from "./SmallText";
import { TableMultiSelect } from "./TableMultiSelect";
import { Text } from "./Text";
import { TextEditor } from "./TextEditor";
import { Time } from "./Time";

interface TableProps {
  doctype: string;
  value: any[];
  onChange: (val: any[]) => void;
  onBlur?: () => void;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  label?: string;
}

interface DoctypeField {
  fieldname: string;
  label: string;
  fieldtype: string;
  in_list_view?: number;
  options?: string;
  reqd?: number;
  default?: any;
  placeholder?: string;
  [key: string]: any;
}

export const Table = ({
  doctype,
  value = [],
  onChange,
  onBlur,
  className = "",
  disabled = false,
  required = false,
  label,
}: TableProps) => {
  const [fields, setFields] = React.useState<DoctypeField[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [docMeta, setDocMeta] = React.useState<any>(null);

  const { post: fetchDocType } = callPost("frappe.desk.form.load.getdoctype");

  React.useEffect(() => {
    const loadMeta = async () => {
      if (!doctype) return;
      try {
        setLoading(true);
        const response = await fetchDocType({
          doctype: doctype,
          with_parent: 0,
        });
        if (response && (response as any).docs && (response as any).docs[0]) {
          const docMeta = (response as any).docs[0];
          setDocMeta(docMeta);
          const listFields = (docMeta.fields || []).filter(
            (f: any) => f.in_list_view === 1,
          );
          setFields(listFields);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    loadMeta();
  }, [doctype]);

  const handleAddField = () => {
    const newRow = fields.reduce(
      (acc, field) => {
        let defaultValue = "";
        switch (field.fieldtype) {
          case "Check":
            defaultValue = 0;
            break;
          case "Int":
          case "Float":
          case "Currency":
          case "Percent":
            defaultValue = 0;
            break;
          case "Date":
          case "Datetime":
          case "Time":
            defaultValue = "";
            break;
          case "Select":
            defaultValue = field.options?.split("\n")[0] || "";
            break;
          case "Table MultiSelect":
            defaultValue = [];
            break;
          default:
            defaultValue = field.default || "";
        }
        acc[field.fieldname] = defaultValue;
        return acc;
      },
      {} as Record<string, any>,
    );

    onChange([...value, newRow]);
  };

  const handleRemoveField = (index: number) => {
    const updated = value.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleCellChange = (index: number, fieldname: string, val: any) => {
    const updated = value.map((row, i) => {
      if (i === index) {
        return { ...row, [fieldname]: val };
      }
      return row;
    });
    onChange(updated);
  };

  const renderField = (field: DoctypeField, row: any, rowIndex: number) => {
    const commonProps = {
      value: row[field.fieldname] || field.default || "",
      onChange: (val: any) => handleCellChange(rowIndex, field.fieldname, val),
      disabled: disabled || false,
      required: field.reqd === 1,
      label: field.label,
      placeholder: field.placeholder,
      className: "w-full",
    };

    switch (field.fieldtype) {
      case "Autocomplete":
        return (
          <Autocomplete
            {...commonProps}
            options={field.options ? JSON.parse(field.options) : []}
          />
        );

      case "Barcode":
        return <Barcode {...commonProps} />;

      case "Button":
        return <ButtonField {...commonProps} label={field.label} />;

      case "Check":
        return (
          <Check
            {...commonProps}
            value={row[field.fieldname] || false}
            onChange={(val: boolean) =>
              handleCellChange(rowIndex, field.fieldname, val ? 1 : 0)
            }
          />
        );

      case "Code":
        return <Code {...commonProps} language="javascript" rows={4} />;

      case "Color":
        return <Color {...commonProps} />;

      case "Currency":
        return (
          <Currency
            {...commonProps}
            value={row[field.fieldname] || 0}
            // currency={field.options || "$"}
          />
        );

      case "Data":
        return <Data {...commonProps} />;

      case "Date":
        return <Date {...commonProps} />;

      case "Datetime":
        return <Datetime {...commonProps} />;

      case "Duration":
        return <Duration {...commonProps} value={row[field.fieldname] || 0} />;

      case "Dynamic Link":
        return (
          <DynamicLink
            {...commonProps}
            referenceDoctype={field.options}
            doctype={field.options}
          />
        );

      case "Float":
        return <Float {...commonProps} value={row[field.fieldname] || 0} />;

      case "Geolocation":
        return (
          <Geolocation {...commonProps} value={row[field.fieldname] || null} />
        );

      case "Heading":
        return <Heading {...commonProps} level={2} />;

      case "HTML":
        return <HTML {...commonProps} content={field.options || ""} />;

      case "HTML Editor":
        return <HTMLEditor {...commonProps} rows={4} />;

      case "Icon":
        return <Icon {...commonProps} />;

      case "Image":
        return <Image {...commonProps} value={row[field.fieldname] || null} />;

      case "Int":
        return <Int {...commonProps} value={row[field.fieldname] || 0} />;

      case "JSON":
        return (
          <JSONField {...commonProps} value={row[field.fieldname] || null} />
        );

      case "Link":
        return (
          <LinkField
            {...commonProps}
            doctype={field.options}
            referenceDoctype={field.options}
          />
        );

      case "Long Text":
        return <LongText {...commonProps} rows={3} />;

      case "Markdown Editor":
        return <MarkdownEditor {...commonProps} rows={4} />;

      case "Password":
        return <Password {...commonProps} showStrength={false} />;

      case "Percent":
        return <Percent {...commonProps} value={row[field.fieldname] || 0} />;

      case "Phone":
        return <Phone {...commonProps} />;

      case "Rating":
        return <Rating {...commonProps} value={row[field.fieldname] || 0} />;

      case "Read Only":
        return <ReadOnly {...commonProps} />;

      case "Select":
        return (
          <Select
            {...commonProps}
            options={
              field.options?.split("\n").map((opt: string) => ({
                label: opt.trim(),
                value: opt.trim(),
              })) || []
            }
          />
        );

      case "Signature":
        return (
          <Signature {...commonProps} value={row[field.fieldname] || null} />
        );

      case "Small Text":
        return <SmallText {...commonProps} />;

      case "Table MultiSelect":
        return (
          <TableMultiSelect
            {...commonProps}
            value={row[field.fieldname] || []}
            options={
              field.options?.split("\n").map((opt: string) => ({
                label: opt.trim(),
                value: opt.trim(),
              })) || []
            }
          />
        );

      case "Text":
        return <Text {...commonProps} />;

      case "Text Editor":
        return <TextEditor {...commonProps} rows={4} />;

      case "Time":
        return <Time {...commonProps} />;

      default:
        // Fallback to text input for unknown types
        return (
          <input
            type="text"
            disabled={disabled}
            value={row[field.fieldname] || ""}
            onChange={(e) =>
              handleCellChange(rowIndex, field.fieldname, e.target.value)
            }
            className="w-full bg-transparent px-2 py-1 text-sm rounded-xs outline-none focus-visible:bg-muted/50 transition-colors"
            // placeholder={`Enter ${field.label}...`}
          />
        );
    }
  };

  const displayLabel = label || doctype;

  return (
    <div
      onBlur={onBlur}
      className={cn("w-full flex flex-col gap-1.5", className)}
    >
      {displayLabel && (
        <label className="text-sm font-medium text-foreground flex items-center gap-0.5 select-none">
          {displayLabel}
          {required && (
            <span className="text-destructive font-bold text-red-500 ml-0.5">
              *
            </span>
          )}
        </label>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground justify-center border rounded-md border-dashed">
          <Loader2 className="size-4 animate-spin" />
          Loading table fields...
        </div>
      ) : (
        <div className="border rounded-md overflow-hidden bg-background">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm border-collapse text-left">
              <thead>
                <tr className="border-b bg-muted/40 transition-colors">
                  {fields.map((field) => (
                    <th
                      key={field.fieldname}
                      className="h-10 px-3 text-left align-middle font-medium text-muted-foreground border-r last:border-r-0 min-w-[120px]"
                    >
                      {field.label}
                      {field.reqd === 1 && (
                        <span className="text-destructive font-bold text-red-500 ml-0.5">
                          *
                        </span>
                      )}
                    </th>
                  ))}
                  <th className="h-10 w-12 px-3 text-center align-middle font-medium text-muted-foreground"></th>
                </tr>
              </thead>
              <tbody>
                {value.length === 0 ? (
                  <tr>
                    <td
                      colSpan={fields.length + 1}
                      className="p-4 text-center text-muted-foreground text-xs"
                    >
                      No rows added yet.
                    </td>
                  </tr>
                ) : (
                  value.map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className="border-b last:border-b-0 hover:bg-muted/20 transition-colors"
                    >
                      {fields.map((field) => (
                        <td
                          key={field.fieldname}
                          className="p-1 border-r last:border-r-0 align-middle"
                        >
                          {renderField(field, row, rowIndex)}
                        </td>
                      ))}
                      <td className="p-1 text-center align-middle">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => handleRemoveField(rowIndex)}
                          className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-md transition-colors disabled:opacity-50"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="p-2 border-t bg-muted/20 flex justify-end">
            <button
              type="button"
              disabled={disabled || fields.length === 0}
              onClick={handleAddField}
              className="flex items-center gap-1.5 text-xs font-medium border px-2.5 py-1.5 rounded-md bg-background shadow-xs hover:bg-muted transition-colors disabled:opacity-50"
            >
              <Plus className="size-3.5" />
              Add Row
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
