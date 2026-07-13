"use client";

import { cn } from "@/lib/utils";
import { Autocomplete } from "./AutoComplete";
import { Barcode } from "./Barcode";
import { Check } from "./Check";
import { ChildTable } from "./ChildTable";
import { Code } from "./Code";
import { Color } from "./Color";
import { Currency } from "./Currency";
import { Data } from "./Data";
import { Date } from "./Date";
import { Datetime } from "./Datetime";
import { Duration } from "./Duration";
import { DynamicLink } from "./DynamicLink";
import { Float } from "./Float";
import { Fold } from "./Fold";
import { Geolocation } from "./Geolocation";
import { HTMLEditor } from "./HTMLEditor";
import { Image } from "./Image";
import { Int } from "./Int";
import { JSON } from "./JSON";
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
import { Table } from "./Table";
import { TableMultiSelect } from "./TableMultiSelect";
import { Text } from "./Text";
import { TextEditor } from "./TextEditor";
import { Time } from "./Time";

export interface FrappeFieldMeta {
  fieldname: string;
  label?: string;
  fieldtype: string;
  options?: string | string[];
  default?: any;
  required?: boolean;
  read_only?: boolean;
  hidden?: boolean;
  description?: string;
  placeholder?: string;
  disabled?: boolean;
  depends_on?: string;
  length?: number;
  precision?: number;
  unique?: boolean;
  in_list_view?: boolean;
  in_standard_filter?: boolean;
  in_global_search?: boolean;
  allow_in_quick_entry?: boolean;
  translatable?: boolean;
  no_copy?: boolean;
  set_only_once?: boolean;
  allow_bulk_edit?: boolean;
  ignore_user_permissions?: boolean;
  hidden_plaintext?: boolean;
  print_hide?: boolean;
  print_hide_if_no_value?: boolean;
  hide_before_desktop_breakpoint?: boolean;
  hide_display?: boolean;
  collapsible?: boolean;
  collapsed?: boolean;
  max_height?: string;
  min_height?: string;
  columns?: number;
  regex?: string;
  max_value?: number;
  min_value?: number;
  max_length?: number;
  min_length?: number;
  fetch_from?: string;
  scale?: number;
  non_negative?: boolean;
  read_only_depends_on?: string;
  bold?: boolean;
  allow_on_submit?: boolean;
  permlevel?: number;
  reqd?: boolean;
  remember_last_used_value?: boolean;
  sortable?: boolean;
  default_based_on?: string;
  default_val?: string;
  default_val_today?: boolean;
  default_val_now?: boolean;
  default_val_user?: boolean;
  default_val_session?: boolean;
  default_val_eval?: string;
  default_val_global?: string;
  default_val_local?: string;
  default_val_parent?: string;
  default_val_link?: string;
  default_val_dynamic?: string;
  default_val_script?: string;
  default_val_sql?: string;
  default_val_function?: string;
  default_val_method?: string;
  default_val_hook?: string;
  default_val_api?: string;
  default_val_webhook?: string;
  default_val_event?: string;
  default_val_cron?: string;
  default_val_schedule?: string;
  default_val_interval?: string;
  default_val_repeat?: string;
  default_val_until?: string;
  default_val_count?: string;
  default_val_weekdays?: string;
  default_val_month?: string;
  default_val_year?: string;
  default_val_hour?: string;
  default_val_minute?: string;
  default_val_second?: string;
  default_val_millisecond?: string;
  default_val_microsecond?: string;
  default_val_nanosecond?: string;
  default_val_timezone?: string;
  default_val_locale?: string;
  default_val_currency?: string;
  default_val_country?: string;
  default_val_language?: string;
  default_val_time_format?: string;
  default_val_date_format?: string;
  default_val_number_format?: string;
  default_val_percent?: string;
  default_val_boolean?: string;
  default_val_rating?: string;
  default_val_color?: string;
  default_val_icon?: string;
  default_val_image?: string;
  default_val_file?: string;
  default_val_attach?: string;
  default_val_signature?: string;
  default_val_barcode?: string;
  default_val_qrcode?: string;
  default_val_geolocation?: string;
  default_val_json?: string;
  default_val_code?: string;
  default_val_html?: string;
  default_val_markdown?: string;
  default_val_text?: string;
  default_val_password?: string;
  default_val_email?: string;
  default_val_url?: string;
  default_val_phone?: string;
  default_val_duration?: string;
  default_val_time?: string;
  default_val_date?: string;
  default_val_datetime?: string;
  default_val_int?: string;
  default_val_float?: string;
  default_val_select?: string;
  default_val_table?: string;
  default_val_table_multiselect?: string;
  default_val_child_table?: string;
  default_val_fold?: string;
  default_val_heading?: string;
  default_val_section_break?: string;
  default_val_column_break?: string;
}

export interface FrappeFieldProps {
  field: FrappeFieldMeta;
  value?: any;
  onChange?: (value: any, fieldname?: string) => void;
  onBlur?: () => void;
  className?: string;
  disabled?: boolean;
  showLabel?: boolean;
  doctype?: string;
  options?: string | string[];
  filters?: Record<string, any>;
  query?: string;
  referenceDoctype?: string;
  linkFieldname?: string;
  width?: number | string;
  rowIndex?: number;
  parentDoctype?: string;
  parentName?: string;
  [key: string]: any;
}

const getFieldType = (fieldtype: string): string => {
  const type = fieldtype.toLowerCase().replace(/\s+/g, " ");
  
  if (type.includes("data") || type === "text" || type === "small_text") return "data";
  if (type.includes("int") || type === "int") return "int";
  if (type.includes("float") || type === "float") return "float";
  if (type.includes("currency")) return "currency";
  if (type.includes("percent")) return "percent";
  if (type.includes("check") || type === "check") return "check";
  if (type.includes("select") && !type.includes("link")) return "select";
  if (type.includes("link")) return "link";
  if (type.includes("dynamic_link")) return "dynamic_link";
  if (type.includes("date")) return "date";
  if (type.includes("datetime")) return "datetime";
  if (type.includes("time")) return "time";
  if (type.includes("duration")) return "duration";
  if (type.includes("password")) return "password";
  if (type.includes("text") && type.includes("editor")) return "text_editor";
  if (type.includes("text") && type.includes("markdown")) return "markdown_editor";
  if (type.includes("text") && type.includes("html")) return "html_editor";
  if (type.includes("long_text") || type === "text") return "long_text";
  if (type.includes("small_text")) return "small_text";
  if (type.includes("phone") || type === "phone") return "phone";
  if (type.includes("email")) return "email";
  if (type.includes("url") || type === "url") return "url";
  if (type.includes("code")) return "code";
  if (type.includes("color")) return "color";
  if (type.includes("rating")) return "rating";
  if (type.includes("barcode")) return "barcode";
  if (type.includes("image")) return "image";
  if (type.includes("signature")) return "signature";
  if (type.includes("geolocation")) return "geolocation";
  if (type.includes("json")) return "json";
  if (type.includes("read_only") || type === "read_only") return "read_only";
  if (type.includes("button")) return "button";
  if (type.includes("heading")) return "heading";
  if (type.includes("fold")) return "fold";
  if (type.includes("table") && type.includes("multi")) return "table_multi_select";
  if (type.includes("table")) return "table";
  if (type.includes("child_table")) return "child_table";
  if (type.includes("section_break")) return "section_break";
  if (type.includes("column_break")) return "column_break";
  if (type.includes("autocomplete")) return "autocomplete";
  
  return "data";
};

const parseOptions = (options?: string | string[]): { label: string; value: string }[] => {
  if (!options) return [];
  
  if (Array.isArray(options)) {
    return options.map(opt => {
      if (typeof opt === "string") {
        return { label: opt, value: opt };
      }
      return opt;
    });
  }
  
  return options.split("\n").map(line => {
    const trimmed = line.trim();
    if (!trimmed) return { label: "", value: "" };
    return { label: trimmed, value: trimmed };
  }).filter(opt => opt.value !== "");
};

export const FrappeField = ({
  field,
  value,
  onChange,
  onBlur,
  className,
  disabled,
  showLabel = true,
  doctype,
  options: optionsProp,
  filters,
  query,
  referenceDoctype,
  linkFieldname,
  width,
  rowIndex,
  parentDoctype,
  parentName,
  ...props
}: FrappeFieldProps) => {
  const fieldType = getFieldType(field.fieldtype);
  const isRequired = field.required || field.reqd;
  const isReadOnly = field.read_only || props.read_only;
  const isHidden = field.hidden;
  
  if (isHidden) return null;
  
  if (fieldType === "section_break") {
    return (
      <div className={cn("col-span-full my-4", className)}>
        <div className="border-t border-border" />
      </div>
    );
  }
  
  if (fieldType === "column_break") {
    return <div className={cn("w-full", className)} />;
  }
  
  if (fieldType === "heading") {
    return (
      <div className={cn("col-span-full", className)}>
        <h3 className="text-lg font-semibold">{field.label || field.fieldname}</h3>
        {field.description && (
          <p className="text-sm text-muted-foreground mt-1">{field.description}</p>
        )}
      </div>
    );
  }
  
  if (fieldType === "fold") {
    return (
      <Fold
        value={value}
        onChange={onChange}
        label={field.label || field.fieldname}
        className={className}
        disabled={disabled}
      >
        {value && typeof value === 'object' && Object.keys(value).map((key) => {
          const nestedField: FrappeFieldMeta = {
            fieldname: key,
            fieldtype: 'Data',
            label: key,
          };
          return (
            <FrappeField
              key={key}
              field={nestedField}
              value={value[key]}
              onChange={(val) => {
                const newValue = { ...value, [key]: val };
                onChange?.(newValue);
              }}
            />
          );
        })}
      </Fold>
    );
  }
  
  const commonProps = {
    value: value ?? field.default ?? "",
    onChange: (val: any) => onChange?.(val, field.fieldname),
    onBlur,
    label: showLabel ? field.label || field.fieldname : undefined,
    placeholder: field.placeholder,
    disabled: disabled || field.disabled,
    required: isRequired,
    description: field.description,
    className: cn(width && `w-[${width}px]`, className),
  };
  
  const renderField = () => {
    switch (fieldType) {
      case "data":
      case "email":
      case "url":
        return (
          <Data
            {...commonProps}
            type={fieldType === "email" ? "email" : fieldType === "url" ? "url" : "text"}
            maxLength={field.length}
            pattern={field.regex}
          />
        );
      
      case "int":
        return (
          <Int 
            {...commonProps} 
            min={field.min_value} 
            max={field.max_value}
            nonNegative={field.non_negative}
          />
        );
      
      case "float":
        return (
          <Float 
            {...commonProps} 
            precision={field.precision} 
            min={field.min_value} 
            max={field.max_value}
            nonNegative={field.non_negative}
          />
        );
      
      case "currency":
        return (
          <Currency
            {...commonProps}
            precision={field.precision}
            currency={props.currency}
            min={field.min_value}
            max={field.max_value}
            nonNegative={field.non_negative}
          />
        );
      
      case "percent":
        return (
          <Percent 
            {...commonProps} 
            precision={field.precision}
            min={field.min_value}
            max={field.max_value}
            nonNegative={field.non_negative}
          />
        );
      
      case "check":
        return (
          <Check
            {...commonProps}
            value={!!value}
            onChange={(val) => onChange?.(val ? 1 : 0, field.fieldname)}
          />
        );
      
      case "select": {
        const selectOptions = parseOptions(optionsProp || field.options);
        return <Select {...commonProps} options={selectOptions} />;
      }
      
      case "link": {
        const linkDoctype = doctype || (typeof field.options === "string" ? field.options : "");
        return (
          <LinkField
            {...commonProps}
            doctype={linkDoctype}
            filters={filters}
            query={query}
          />
        );
      }
      
      case "dynamic_link": {
        const refDoctype = referenceDoctype || (typeof field.options === "string" ? field.options : "");
        return (
          <DynamicLink
            {...commonProps}
            doctype={parentDoctype}
            referenceDoctype={refDoctype}
            linkFieldname={linkFieldname}
            filters={filters}
          />
        );
      }
      
      case "date":
        return <Date {...commonProps} hideDays={field.hide_days} />;
      
      case "datetime":
        return <Datetime {...commonProps} hideDays={field.hide_days} hideSeconds={field.hide_seconds} />;
      
      case "time":
        return <Time {...commonProps} hideSeconds={field.hide_seconds} />;
      
      case "duration":
        return <Duration {...commonProps} hideDays={field.hide_days} hideSeconds={field.hide_seconds} />;
      
      case "password":
        return <Password {...commonProps} />;
      
      case "text_editor":
        return <TextEditor {...commonProps} />;
      
      case "markdown_editor":
        return <MarkdownEditor {...commonProps} />;
      
      case "html_editor":
        return <HTMLEditor {...commonProps} />;
      
      case "long_text":
      case "text":
        return <LongText {...commonProps} maxLength={field.length} rows={5} />;
      
      case "small_text":
        return <SmallText {...commonProps} maxLength={field.length} />;
      
      case "phone":
        return <Phone {...commonProps} mask={field.mask} />;
      
      case "code":
        return <Code {...commonProps} language={typeof field.options === "string" ? field.options : ""} />;
      
      case "color":
        return <Color {...commonProps} />;
      
      case "rating":
        return <Rating {...commonProps} max={5} />;
      
      case "barcode":
        return <Barcode {...commonProps} value={value || ""} />;
      
      case "image":
        return <Image {...commonProps} value={value} />;
      
      case "signature":
        return <Signature {...commonProps} value={value} />;
      
      case "geolocation":
        return <Geolocation {...commonProps} value={value} />;
      
      case "json":
        return <JSON {...commonProps} value={value} />;
      
      case "read_only":
        return <ReadOnly {...commonProps} value={value} />;
      
      case "button":
        return (
          <div className={commonProps.className}>
            <button
              type="button"
              onClick={() => props.onClick?.(field.fieldname)}
              disabled={commonProps.disabled}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 h-9 px-4 py-2"
            >
              {field.label || field.fieldname}
            </button>
          </div>
        );
      
      case "autocomplete":
        return (
          <Autocomplete
            {...commonProps}
            options={parseOptions(optionsProp || field.options)}
          />
        );
      
      case "table": {
        const tableDoctype = typeof field.options === "string" ? field.options : "";
        return (
          <Table
            {...commonProps}
            doctype={tableDoctype}
            value={value}
          />
        );
      }
      
      case "child_table": {
        const childDoctype = typeof field.options === "string" ? field.options : "";
        return (
          <ChildTable
            {...commonProps}
            doctype={childDoctype}
            value={value}
            rowIndex={rowIndex}
          />
        );
      }
      
      case "table_multi_select": {
        const multiSelectOptions = parseOptions(optionsProp || field.options);
        return (
          <TableMultiSelect
            {...commonProps}
            value={value || []}
            options={multiSelectOptions}
          />
        );
      }
      
      default:
        return <Data {...commonProps} />;
    }
  };
  
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5",
        width && `inline-block`,
        className,
      )}
      style={
        width
          ? { width: typeof width === "number" ? `${width}px` : width }
          : undefined
      }
    >
      {renderField()}
    </div>
  );
};

export default FrappeField;