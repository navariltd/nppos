"use client";

import type { FrappeFieldMeta } from "@/components/fields";
import { FrappeField, LinkField } from "@/components/fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { clearPageState, usePageState } from "@/hooks/use-page-state";
import { callPost } from "@/lib/frappe-service";
import {
  Code,
  Eye,
  FileText,
  Loader2,
  Play,
  RefreshCw,
  Settings,
  Table2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const FIELD_TYPES = [
  "Data",
  "Text",
  "Small Text",
  "Long Text",
  "Int",
  "Float",
  "Currency",
  "Percent",
  "Check",
  "Select",
  "Link",
  "Dynamic Link",
  "Date",
  "Datetime",
  "Time",
  "Duration",
  "Password",
  "Text Editor",
  "Markdown Editor",
  "HTML Editor",
  "Phone",
  "Email",
  "URL",
  "Code",
  "Color",
  "Rating",
  "Barcode",
  "Image",
  "Signature",
  "Geolocation",
  "JSON",
  "Read Only",
  "Button",
  "Autocomplete",
  "Table",
  "Table MultiSelect",
  "Fold",
  "Heading",
];

interface FieldConfig {
  fieldname: string;
  label: string;
  fieldtype: string;
  options?: string;
  required?: boolean;
  read_only?: boolean;
  placeholder?: string;
  description?: string;
}

interface TableRowEditorProps {
  isOpen: boolean;
  onClose: () => void;
  doctype: string;
  rowData: Record<string, any>;
  onSave: (data: Record<string, any>) => void;
  onDelete?: () => void;
}

const TableRowEditor = ({
  isOpen,
  onClose,
  doctype,
  rowData,
  onSave,
  onDelete,
}: TableRowEditorProps) => {
  const [fields, setFields] = useState<FrappeFieldMeta[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && doctype) {
      loadDoctypeMeta();
    }
  }, [isOpen, doctype]);

  useEffect(() => {
    if (rowData && Object.keys(rowData).length > 0) {
      setFormData(rowData);
    } else {
      setFormData({});
    }
  }, [rowData]);

  const loadDoctypeMeta = async () => {
    setLoading(true);
    try {
      const { post } = callPost("frappe.desk.form.load.getdoctype");
      const response = await post({ doctype, with_parent: 0 });
      if (response && (response as any).docs && (response as any).docs[0]) {
        const docMeta = (response as any).docs[0];
        const formFields = (docMeta.fields || [])
          .filter(
            (f: any) =>
              !f.hidden &&
              f.fieldtype !== "Section Break" &&
              f.fieldtype !== "Column Break" &&
              f.fieldtype !== "Table",
          )
          .map((f: any) => ({
            fieldname: f.fieldname,
            label: f.label,
            fieldtype: f.fieldtype,
            options: f.options,
            required: f.reqd === 1,
            read_only: f.read_only,
            placeholder: f.placeholder,
          }));
        setFields(formFields);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (value: any, fieldname?: string) => {
    if (!fieldname) return;
    setFormData((prev) => ({ ...prev, [fieldname]: value }));
  };

  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="bg-background border rounded-lg shadow-lg w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <h3 className="text-lg font-semibold">
              {rowData && Object.keys(rowData).length > 0
                ? "Edit Row"
                : "Add Row"}{" "}
              - {doctype}
            </h3>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            ✕
          </Button>
        </div>

        <ScrollArea className="flex-1 p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {fields.map((field) => (
                <FrappeField
                  key={field.fieldname}
                  field={field}
                  value={formData[field.fieldname]}
                  onChange={handleChange}
                  doctype={doctype}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="flex items-center justify-between p-4 border-t">
          <div>
            {onDelete && rowData && Object.keys(rowData).length > 0 && (
              <Button variant="destructive" onClick={onDelete}>
                Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save</Button>
          </div>
        </div>
      </div>
    </div> 
  );
};

export default function PlaygroundPage() {
  const location = useLocation();
  const [selectedFieldType, setSelectedFieldType] = usePageState<string>(
    "selectedFieldType",
    "Data",
  );
  const [fieldConfig, setFieldConfig] = usePageState<FieldConfig>(
    "fieldConfig",
    {
      fieldname: "test_field",
      label: "Test Field",
      fieldtype: "Data",
      placeholder: "Enter value...",
    },
  );
  const [fieldValue, setFieldValue] = usePageState<any>("fieldValue", "");
  const [activeTab, setActiveTab] = usePageState("activeTab", "preview");
  const [tableValue, setTableValue] = usePageState<Record<string, any>[]>(
    "tableValue",
    [],
  );
  const [editingRow, setEditingRow] = useState<Record<string, any> | null>(
    null,
  );
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [tableMultiSelectLinkField, setTableMultiSelectLinkField] =
    usePageState<string>("tableMultiSelectLinkField", "");

  const [parentDoctypes, setParentDoctypes] = usePageState<string[]>(
    "parentDoctypes",
    [],
  );
  const [childDoctypes, setChildDoctypes] = usePageState<string[]>(
    "childDoctypes",
    [],
  );
  const [loadingDoctypes, setLoadingDoctypes] = useState(false);
  const [doctypesLoaded, setDoctypesLoaded] = usePageState(
    "doctypesLoaded",
    false,
  );

  const { post: getList } = callPost("frappe.client.get_list");

  const fetchDoctypes = useCallback(
    async (istable: number): Promise<string[]> => {
      try {
        const response = await getList({
          doctype: "DocType",
          fields: ["name"],
          filters: [["istable", "=", istable]],
          limit_page_length: 100,
          order_by: "name asc",
        });
        const data = (response as any)?.message || response;
        if (Array.isArray(data)) {
          return data.map((d: any) => d.name);
        }
        return [];
      } catch (error) {
        console.error(error);
        return [];
      }
    },
    [getList],
  );

  const loadDoctypes = useCallback(async () => {
    if (doctypesLoaded) return;
    setLoadingDoctypes(true);
    try {
      const [parents, children] = await Promise.all([
        fetchDoctypes(0),
        fetchDoctypes(1),
      ]);
      setParentDoctypes(parents);
      setChildDoctypes(children);
      setDoctypesLoaded(true);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingDoctypes(false);
    }
  }, [fetchDoctypes, doctypesLoaded]);

  useEffect(() => {
    loadDoctypes();
  }, [loadDoctypes]);

  useEffect(() => {
    let defaultOptions = fieldConfig.options;
    const fieldType = selectedFieldType;

    if (fieldType === "Select") {
      defaultOptions = "Option 1\nOption 2\nOption 3";
    } else if (
      fieldType === "Link" ||
      fieldType === "Dynamic Link" ||
      fieldType === "Autocomplete"
    ) {
      defaultOptions = parentDoctypes.length > 0 ? parentDoctypes[0] : "";
    } else if (fieldType === "Table" || fieldType === "Table MultiSelect") {
      defaultOptions = childDoctypes.length > 0 ? childDoctypes[0] : "";
    }

    setFieldConfig((prev) => ({
      ...prev,
      fieldtype: fieldType,
      options: defaultOptions || prev.options,
    }));
  }, [selectedFieldType, parentDoctypes, childDoctypes]);

  useEffect(() => {
    if (selectedFieldType === "Table MultiSelect" && fieldConfig.options) {
      fetchLinkFieldForDoctype(fieldConfig.options);
    } else if (selectedFieldType !== "Table MultiSelect") {
      setTableMultiSelectLinkField("");
    }
  }, [selectedFieldType, fieldConfig.options]);

  const fetchLinkFieldForDoctype = async (doctype: string) => {
    try {
      const { post } = callPost("frappe.desk.form.load.getdoctype");
      const response = await post({ doctype, with_parent: 0 });
      if (response && (response as any).docs && (response as any).docs[0]) {
        const docMeta = (response as any).docs[0];
        const linkField = (docMeta.fields || []).find(
          (f: any) => f.fieldtype === "Link" && !f.hidden,
        );
        if (linkField) {
          setTableMultiSelectLinkField(linkField.fieldname);
        }
      }
    } catch (error) {
      console.error(error);
    }
  };

  const resetPlayground = () => {
    clearPageState(location.pathname);
    setFieldValue("");
    setTableValue([]);
    setParentDoctypes([]);
    setChildDoctypes([]);
    setDoctypesLoaded(false);
    setSelectedFieldType("Data");
    setFieldConfig({
      fieldname: "test_field",
      label: "Test Field",
      fieldtype: "Data",
      placeholder: "Enter value...",
    });
    setActiveTab("preview");
    setTableMultiSelectLinkField("");
  };

  const getFieldTypeDescription = (type: string): string => {
    const descriptions: Record<string, string> = {
      Data: "Basic text input field",
      Text: "Multi-line text input",
      "Small Text": "Single line text input",
      "Long Text": "Large multi-line text area",
      Int: "Integer number input",
      Float: "Decimal number input",
      Currency: "Currency input with symbol",
      Percent: "Percentage input",
      Check: "Boolean checkbox",
      Select: "Dropdown selection",
      Link: "Link to another DocType (istable == 0)",
      "Dynamic Link": "Dynamic link based on another field (istable == 0)",
      Date: "Date picker",
      Datetime: "Date and time picker",
      Time: "Time picker",
      Duration: "Duration input",
      Password: "Password input (masked)",
      "Text Editor": "Rich text editor",
      "Markdown Editor": "Markdown editor",
      "HTML Editor": "HTML editor",
      Phone: "Phone number input",
      Email: "Email input",
      URL: "URL input",
      Code: "Code editor with syntax highlighting",
      Color: "Color picker",
      Rating: "Star rating input",
      Barcode: "Barcode display/input",
      Image: "Image upload/display",
      Signature: "Signature pad",
      Geolocation: "Geolocation picker",
      JSON: "JSON editor",
      "Read Only": "Read-only display",
      Button: "Action button",
      Autocomplete: "Autocomplete with search (istable == 0)",
      Table: "Child table (istable == 1) with multiple rows",
      "Table MultiSelect": "Multi-select table (istable == 1)",
      Fold: "Collapsible section",
      Heading: "Section heading",
    };
    return descriptions[type] || "Custom field type";
  };

  const buildFieldMeta = (): FrappeFieldMeta => {
    const base: FrappeFieldMeta = {
      fieldname: fieldConfig.fieldname,
      label: fieldConfig.label,
      fieldtype: fieldConfig.fieldtype,
      required: fieldConfig.required,
      read_only: fieldConfig.read_only,
      placeholder: fieldConfig.placeholder,
      description: fieldConfig.description,
    };

    if (fieldConfig.options) {
      base.options = fieldConfig.options;
    }

    if (fieldConfig.required) base.reqd = true;
    if (fieldConfig.read_only) base.read_only = true;

    if (
      ["Int", "Float", "Currency", "Percent"].includes(fieldConfig.fieldtype)
    ) {
      base.min_value = 0;
      base.max_value = fieldConfig.fieldtype === "Percent" ? 100 : 100000;
      base.non_negative = true;
    }

    if (
      ["Data", "Small Text", "Long Text", "Text"].includes(
        fieldConfig.fieldtype,
      )
    ) {
      base.length = 140;
    }

    return base;
  };

  const isLinkField =
    selectedFieldType === "Link" ||
    selectedFieldType === "Dynamic Link" ||
    selectedFieldType === "Autocomplete";
  const isTableField =
    selectedFieldType === "Table" || selectedFieldType === "Table MultiSelect";
  const currentDoctypes = isTableField
    ? childDoctypes
    : isLinkField
      ? parentDoctypes
      : [];

  return (
    <div className="px-4 lg:px-6">
      <div className="container mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">FrappeField Playground</h1>
            <p className="text-muted-foreground mt-1">
              Interactive testing environment for Frappe field components
            </p>
          </div>
          <Button onClick={resetPlayground} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div className="border rounded-lg p-4 space-y-4 bg-background">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Field Configuration</h2>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="fieldtype">Field Type</Label>
                <Select
                  value={selectedFieldType}
                  onValueChange={setSelectedFieldType}
                >
                  <SelectTrigger id="fieldtype">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <ScrollArea className="h-[300px]">
                      {FIELD_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </ScrollArea>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {getFieldTypeDescription(selectedFieldType)}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fieldname">Fieldname</Label>
                <Input
                  id="fieldname"
                  value={fieldConfig.fieldname}
                  onChange={(e) =>
                    setFieldConfig((prev) => ({
                      ...prev,
                      fieldname: e.target.value,
                    }))
                  }
                  placeholder="field_name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="label">Label</Label>
                <Input
                  id="label"
                  value={fieldConfig.label}
                  onChange={(e) =>
                    setFieldConfig((prev) => ({
                      ...prev,
                      label: e.target.value,
                    }))
                  }
                  placeholder="Field Label"
                />
              </div>

              {(selectedFieldType === "Select" ||
                selectedFieldType === "Link" ||
                selectedFieldType === "Table" ||
                selectedFieldType === "Table MultiSelect" ||
                selectedFieldType === "Autocomplete" ||
                selectedFieldType === "Dynamic Link") && (
                <div className="space-y-2">
                  <Label htmlFor="options">
                    {selectedFieldType === "Table" ||
                    selectedFieldType === "Table MultiSelect"
                      ? "Child DocType (istable == 1)"
                      : selectedFieldType === "Select"
                        ? "Options (one per line)"
                        : "Parent DocType (istable == 0)"}
                  </Label>
                  {isLinkField || isTableField ? (
                    <LinkField
                      doctype={"DocType"}
                      value={fieldConfig.options || ""}
                      onChange={(value) => {
                        setFieldConfig((prev) => ({
                          ...prev,
                          options: value,
                        }));
                      }}
                      filters={
                        isTableField
                          ? { istable: 1 }
                          : { istable: 0 }
                      }
                    />
                  ) : (
                    <Textarea
                      id="options"
                      value={fieldConfig.options}
                      onChange={(e) =>
                        setFieldConfig((prev) => ({
                          ...prev,
                          options: e.target.value,
                        }))
                      }
                      placeholder="Option 1\nOption 2\nOption 3"
                      rows={4}
                    />
                  )}
                  <p className="text-xs text-muted-foreground">
                    {isTableField &&
                      'Child doctypes have istable == 1 (fetched via frappe.client.get_list with filter ["istable", "=", 1])'}
                    {isLinkField &&
                      'Parent doctypes have istable == 0 (fetched via frappe.client.get_list with filter ["istable", "=", 0])'}
                    {selectedFieldType === "Select" &&
                      "Enter each option on a new line"}
                  </p>
                </div>
              )}

              {selectedFieldType === "Table MultiSelect" &&
                tableMultiSelectLinkField && (
                  <div className="p-2 bg-muted/50 rounded border">
                    <p className="text-xs text-muted-foreground">
                      Link field:{" "}
                      <code className="bg-background px-1 rounded font-mono">
                        {tableMultiSelectLinkField}
                      </code>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      The first Link field in the child doctype is used for
                      multi-select
                    </p>
                  </div>
                )}

              <div className="space-y-2">
                <Label htmlFor="placeholder">Placeholder</Label>
                <Input
                  id="placeholder"
                  value={fieldConfig.placeholder}
                  onChange={(e) =>
                    setFieldConfig((prev) => ({
                      ...prev,
                      placeholder: e.target.value,
                    }))
                  }
                  placeholder="Enter placeholder text..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={fieldConfig.description}
                  onChange={(e) =>
                    setFieldConfig((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Field description..."
                  rows={2}
                />
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="required"
                    checked={fieldConfig.required}
                    onCheckedChange={(checked) =>
                      setFieldConfig((prev) => ({
                        ...prev,
                        required: checked === true,
                      }))
                    }
                  />
                  <Label htmlFor="required" className="text-sm cursor-pointer">
                    Required
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="read_only"
                    checked={fieldConfig.read_only}
                    onCheckedChange={(checked) =>
                      setFieldConfig((prev) => ({
                        ...prev,
                        read_only: checked === true,
                      }))
                    }
                  />
                  <Label htmlFor="read_only" className="text-sm cursor-pointer">
                    Read Only
                  </Label>
                </div>
              </div>
            </div>

          </div>

          <div className="lg:col-span-2">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="w-full"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="preview">
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </TabsTrigger>
                <TabsTrigger value="code">
                  <Code className="h-4 w-4 mr-2" />
                  Code
                </TabsTrigger>
              </TabsList>

              <TabsContent value="preview" className="space-y-4">
                <div className="border rounded-lg p-6 bg-background">
                  <div className="flex items-center gap-2 mb-4">
                    <Play className="h-5 w-5" />
                    <h3 className="font-semibold">Live Preview</h3>
                    <Badge variant="secondary">{selectedFieldType}</Badge>
                  </div>

                  <Separator className="mb-6" />

                  <div className="max-w-2xl">
                    <FrappeField
                      field={buildFieldMeta()}
                      value={isTableField ? tableValue : fieldValue}
                      onChange={(val) => {
                        if (isTableField) {
                          setTableValue(val || []);
                        } else {
                          setFieldValue(val);
                        }
                      }}
                      doctype={fieldConfig.options}
                      linkFieldname={
                        isTableField ? tableMultiSelectLinkField : undefined
                      }
                    />
                  </div>

                  <div className="mt-6 p-4 bg-muted/20 rounded-lg">
                    <Label className="text-sm font-medium">
                      Current Value:
                    </Label>
                    <pre className="mt-2 text-xs bg-background p-3 rounded border overflow-auto">
                      {JSON.stringify(
                        isTableField ? tableValue : fieldValue,
                        null,
                        2,
                      )}
                    </pre>
                  </div>
                </div>

                {isTableField && (
                  <div className="border rounded-lg p-4 bg-background">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Table Controls</h3>
                      <Button
                        size="sm"
                        onClick={() => {
                          setIsEditorOpen(true);
                          setEditingRow(null);
                        }}
                      >
                        Add Row
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="code">
                <div className="border rounded-lg p-6 bg-background">
                  <h3 className="font-semibold mb-4">Generated Code</h3>
                  <ScrollArea className="h-[500px]">
                    <pre className="text-xs bg-muted/20 p-4 rounded-lg overflow-auto">
                      <code>{`import { FrappeField } from "@/components/fields";

const field: FrappeFieldMeta = ${JSON.stringify(buildFieldMeta(), null, 2)};

<FrappeField
  field={field}
  value={${JSON.stringify(isTableField ? tableValue : fieldValue)}}
  onChange={(value, fieldname) => {
    console.log("Value changed:", value, fieldname);
  }}
  doctype="${fieldConfig.options || ""}"
  ${fieldConfig.required ? "required" : ""}
  ${fieldConfig.read_only ? "read_only" : ""}
/>`}</code>
                    </pre>
                  </ScrollArea>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      <TableRowEditor
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setEditingRow(null);
        }}
        doctype={fieldConfig.options || ""}
        rowData={editingRow || {}}
        onSave={(data) => {
          if (editingRow && Object.keys(editingRow).length > 0) {
            setTableValue((prev) =>
              prev.map((row, index) => (row === editingRow ? data : row)),
            );
          } else {
            setTableValue((prev) => [...prev, data]);
          }
          setIsEditorOpen(false);
          setEditingRow(null);
        }}
        onDelete={
          editingRow
            ? () => {
                if (editingRow) {
                  setTableValue((prev) =>
                    prev.filter((row) => row !== editingRow),
                  );
                  setIsEditorOpen(false);
                  setEditingRow(null);
                }
              }
            : undefined
        }
      />
    </div>
  );
}
