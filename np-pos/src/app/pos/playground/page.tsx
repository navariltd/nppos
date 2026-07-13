"use client";

import { useState, useEffect } from "react";
import { BaseLayout } from "@/components/layouts/base-layout";
import { FrappeField } from "@/components/fields";
import type { FrappeFieldMeta } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { callPost } from "@/lib/frappe-service";
import {
  Play,
  Settings,
  Code,
  Eye,
  RefreshCw,
  Table2,
  FileText,
} from "lucide-react";

// Available field types for testing
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

// Sample doctypes for testing - will be filtered based on field type
const ALL_DOCTYPES = [
  "Customer",
  "Supplier",
  "Item",
  "Sales Invoice",
  "Purchase Order",
  "Stock Entry",
  "Payment Entry",
  "Journal Entry",
  "Sales Invoice Item",
  "Purchase Order Item",
  "Stock Entry Detail",
  "Payment Entry Deduction",
  "Journal Entry Account",
];

// Child doctypes (Table/Table MultiSelect fields) - these have is_child_table = 1
const CHILD_DOCTYPES = [
  "Sales Invoice Item",
  "Purchase Order Item",
  "Stock Entry Detail",
  "Payment Entry Deduction",
  "Journal Entry Account",
];

// Non-child doctypes (Link fields) - these have is_child_table = 0
const PARENT_DOCTYPES = ALL_DOCTYPES.filter(dt => !CHILD_DOCTYPES.includes(dt));

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
          .filter((f: any) => !f.hidden && f.fieldtype !== "Section Break" && f.fieldtype !== "Column Break" && f.fieldtype !== "Table")
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
      console.error("Error loading doctype meta:", error);
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
              {rowData && Object.keys(rowData).length > 0 ? "Edit Row" : "Add Row"} - {doctype}
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
  const [selectedFieldType, setSelectedFieldType] = useState<string>("Data");
  const [fieldConfig, setFieldConfig] = useState<FieldConfig>({
    fieldname: "test_field",
    label: "Test Field",
    fieldtype: "Data",
    placeholder: "Enter value...",
  });
  const [fieldValue, setFieldValue] = useState<any>("");
  const [activeTab, setActiveTab] = useState("preview");
  const [doctypeData, setDoctypeData] = useState<Record<string, any>[]>([]);
  const [tableValue, setTableValue] = useState<Record<string, any>[]>([]);
  const [editingRow, setEditingRow] = useState<Record<string, any> | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [loadingDoctype, setLoadingDoctype] = useState(false);
  const [tableMultiSelectLinkField, setTableMultiSelectLinkField] = useState<string>("");

  // Update field config when type changes
  useEffect(() => {
    let defaultOptions = fieldConfig.options;
    
    // Set smart defaults based on field type
    if (selectedFieldType === "Select") {
      defaultOptions = "Option 1\nOption 2\nOption 3";
    } else if (selectedFieldType === "Link") {
      defaultOptions = "Customer"; // Default to first parent doctype
    } else if (selectedFieldType === "Table") {
      defaultOptions = "Sales Invoice Item"; // Default to first child doctype
    } else if (selectedFieldType === "Table MultiSelect") {
      defaultOptions = "Customer"; // Default to parent doctype (to get link field from)
    } else if (selectedFieldType === "Dynamic Link") {
      defaultOptions = "Customer"; // Default to parent doctype
    } else if (selectedFieldType === "Autocomplete") {
      defaultOptions = "Customer";
    }
    
    setFieldConfig({
      ...fieldConfig,
      fieldtype: selectedFieldType,
      options: defaultOptions,
    });
  }, [selectedFieldType]);

  // Fetch link field for Table MultiSelect when doctype changes
  useEffect(() => {
    if (selectedFieldType === "Table MultiSelect" && fieldConfig.options) {
      fetchLinkFieldForDoctype(fieldConfig.options);
    } else if (selectedFieldType !== "Table MultiSelect") {
      // Clear link field when not using Table MultiSelect
      setTableMultiSelectLinkField("");
    }
  }, [selectedFieldType, fieldConfig.options]);

  // Get filtered doctypes based on field type
  const getFilteredDoctypes = () => {
    switch (selectedFieldType) {
      case "Link":
      case "Autocomplete":
      case "Dynamic Link":
        // Link fields should only show parent doctypes (is_child_table = 0)
        return PARENT_DOCTYPES;
      case "Table":
      case "Table MultiSelect":
        // Table fields should only show child doctypes (is_child_table = 1)
        return CHILD_DOCTYPES;
      default:
        return ALL_DOCTYPES;
    }
  };

  const fetchLinkFieldForDoctype = async (doctype: string) => {
    try {
      const { post } = callPost("frappe.desk.form.load.getdoctype");
      const response = await post({ doctype, with_parent: 0 });
      if (response && (response as any).docs && (response as any).docs[0]) {
        const docMeta = (response as any).docs[0];
        // Find the first Link field in the doctype
        const linkField = (docMeta.fields || []).find(
          (f: any) => f.fieldtype === "Link" && !f.hidden
        );
        if (linkField) {
          setTableMultiSelectLinkField(linkField.fieldname);
        }
      }
    } catch (error) {
      console.error("Error fetching link field:", error);
    }
  };

  const loadDoctypeData = async (doctype: string) => {
    setLoadingDoctype(true);
    try {
      const { post } = callPost("frappe.desk.search.search_link");
      const response = await post({
        txt: "",
        doctype,
        page_length: 10,
      });
      const message = (response as any)?.message || [];
      setDoctypeData(message.slice(0, 10));
    } catch (error) {
      console.error("Error loading doctype data:", error);
    } finally {
      setLoadingDoctype(false);
    }
  };

  const handleTableRowAdd = () => {
    setIsEditorOpen(true);
    setEditingRow(null);
  };

  const handleTableRowEdit = (row: Record<string, any>) => {
    setEditingRow(row);
    setIsEditorOpen(true);
  };

  const handleTableRowSave = (data: Record<string, any>) => {
    if (editingRow && Object.keys(editingRow).length > 0) {
      // Update existing row
      setTableValue((prev) =>
        prev.map((row, index) => (row === editingRow ? data : row))
      );
    } else {
      // Add new row
      setTableValue((prev) => [...prev, data]);
    }
    setIsEditorOpen(false);
    setEditingRow(null);
  };

  const handleTableRowDelete = () => {
    if (editingRow) {
      setTableValue((prev) => prev.filter((row) => row !== editingRow));
      setIsEditorOpen(false);
      setEditingRow(null);
    }
  };

  const resetPlayground = () => {
    setFieldValue("");
    setTableValue([]);
    setDoctypeData([]);
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
      Link: "Link to another DocType",
      "Dynamic Link": "Dynamic link based on another field",
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
      Autocomplete: "Autocomplete with search",
      Table: "Child table with multiple rows",
      "Table MultiSelect": "Multi-select table (uses first Link field)",
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
      // For Table MultiSelect, append the link field to options
      if (fieldConfig.fieldtype === "Table MultiSelect" && tableMultiSelectLinkField) {
        base.options = `${fieldConfig.options}\n${tableMultiSelectLinkField}`;
      } else {
        base.options = fieldConfig.options;
      }
    }

    return base;
  };

  return (
    <BaseLayout title="Field Playground" description="Test and preview Frappe field components">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
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
          {/* Configuration Panel */}
          <div className="lg:col-span-1 space-y-4">
            <div className="border rounded-lg p-4 space-y-4 bg-background">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Field Configuration</h2>
              </div>

              <Separator />

              {/* Field Type Selector */}
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

              {/* Fieldname */}
              <div className="space-y-2">
                <Label htmlFor="fieldname">Fieldname</Label>
                <Input
                  id="fieldname"
                  value={fieldConfig.fieldname}
                  onChange={(e) =>
                    setFieldConfig((prev) => ({ ...prev, fieldname: e.target.value }))
                  }
                  placeholder="field_name"
                />
              </div>

              {/* Label */}
              <div className="space-y-2">
                <Label htmlFor="label">Label</Label>
                <Input
                  id="label"
                  value={fieldConfig.label}
                  onChange={(e) =>
                    setFieldConfig((prev) => ({ ...prev, label: e.target.value }))
                  }
                  placeholder="Field Label"
                />
              </div>

              {/* Options (for Select, Link, Table, etc.) */}
              {(selectedFieldType === "Select" ||
                selectedFieldType === "Link" ||
                selectedFieldType === "Table" ||
                selectedFieldType === "Table MultiSelect" ||
                selectedFieldType === "Autocomplete" ||
                selectedFieldType === "Dynamic Link") && (
                <div className="space-y-2">
                  <Label htmlFor="options">
                    {selectedFieldType === "Table"
                      ? "Child Table DocType (is_child_table = 1)"
                      : selectedFieldType === "Table MultiSelect"
                      ? "Parent DocType (is_child_table = 0)"
                      : selectedFieldType === "Select"
                      ? "Options (one per line)"
                      : "Link (is_child_table = 0)"}
                  </Label>
                  {selectedFieldType === "Table" ? (
                    // Table: Select child doctype (is_child_table = 1)
                    <Select
                      value={fieldConfig.options}
                      onValueChange={(value) =>
                        setFieldConfig((prev) => ({ ...prev, options: value }))
                      }
                    >
                      <SelectTrigger id="options">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CHILD_DOCTYPES.map((dt) => (
                          <SelectItem key={dt} value={dt}>
                            {dt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : selectedFieldType === "Table MultiSelect" ? (
                    // Table MultiSelect: Select parent doctype (is_child_table = 0)
                    <div className="space-y-2">
                      <Select
                        value={fieldConfig.options}
                        onValueChange={(value) => {
                          setFieldConfig((prev) => ({ ...prev, options: value }));
                          setTableMultiSelectLinkField(""); // Reset link field when doctype changes
                        }}
                      >
                        <SelectTrigger id="options">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PARENT_DOCTYPES.map((dt) => (
                            <SelectItem key={dt} value={dt}>
                              {dt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {tableMultiSelectLinkField && (
                        <div className="p-2 bg-muted/50 rounded border">
                          <p className="text-xs text-muted-foreground">
                            Link field: <code className="bg-background px-1 rounded font-mono">{tableMultiSelectLinkField}</code>
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            This field will be used to select multiple records
                          </p>
                        </div>
                      )}
                    </div>
                  ) : selectedFieldType === "Select" ? (
                    <Textarea
                      id="options"
                      value={fieldConfig.options}
                      onChange={(e) =>
                        setFieldConfig((prev) => ({ ...prev, options: e.target.value }))
                      }
                      placeholder="Option 1\nOption 2\nOption 3"
                      rows={4}
                    />
                  ) : (
                    // Link, Autocomplete, Dynamic Link: Select parent doctype (is_child_table = 0)
                    <Select
                      value={fieldConfig.options}
                      onValueChange={(value) =>
                        setFieldConfig((prev) => ({ ...prev, options: value }))
                      }
                    >
                      <SelectTrigger id="options">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PARENT_DOCTYPES.map((dt) => (
                          <SelectItem key={dt} value={dt}>
                            {dt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {selectedFieldType === "Table" && (
                    <p className="text-xs text-muted-foreground">
                      Select a child doctype (is_child_table = 1)
                    </p>
                  )}
                  {selectedFieldType === "Table MultiSelect" && (
                    <p className="text-xs text-muted-foreground">
                      Select a parent doctype (is_child_table = 0). The first Link field will be used for multi-select
                    </p>
                  )}
                  {(selectedFieldType === "Link" || selectedFieldType === "Autocomplete" || selectedFieldType === "Dynamic Link") && (
                    <p className="text-xs text-muted-foreground">
                      Select a parent doctype (is_child_table = 0)
                    </p>
                  )}
                </div>
              )}

              {/* Placeholder */}
              <div className="space-y-2">
                <Label htmlFor="placeholder">Placeholder</Label>
                <Input
                  id="placeholder"
                  value={fieldConfig.placeholder}
                  onChange={(e) =>
                    setFieldConfig((prev) => ({ ...prev, placeholder: e.target.value }))
                  }
                  placeholder="Enter placeholder text..."
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={fieldConfig.description}
                  onChange={(e) =>
                    setFieldConfig((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Field description..."
                  rows={2}
                />
              </div>

              {/* Checkboxes */}
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={fieldConfig.required}
                    onChange={(e) =>
                      setFieldConfig((prev) => ({ ...prev, required: e.target.checked }))
                    }
                    className="rounded"
                  />
                  <span className="text-sm">Required</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={fieldConfig.read_only}
                    onChange={(e) =>
                      setFieldConfig((prev) => ({ ...prev, read_only: e.target.checked }))
                    }
                    className="rounded"
                  />
                  <span className="text-sm">Read Only</span>
                </label>
              </div>
            </div>

            {/* Doctype Data Preview */}
            {(selectedFieldType === "Link" || selectedFieldType === "Autocomplete") &&
              fieldConfig.options && (
                <div className="border rounded-lg p-4 space-y-3 bg-background">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Table2 className="h-5 w-5" />
                      <h3 className="font-semibold">Sample Data: {fieldConfig.options}</h3>
                      {CHILD_DOCTYPES.includes(fieldConfig.options) && (
                        <Badge variant="outline" className="text-xs">Child DocType</Badge>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => loadDoctypeData(fieldConfig.options!)}
                      disabled={loadingDoctype}
                    >
                      {loadingDoctype ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      ) : (
                        "Load"
                      )}
                    </Button>
                  </div>
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-1">
                      {doctypeData.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-2 text-sm border rounded hover:bg-accent cursor-pointer"
                        >
                          <div className="font-medium">{item.label || item.value}</div>
                          {item.description && (
                            <div className="text-xs text-muted-foreground">
                              {item.description}
                            </div>
                          )}
                        </div>
                      ))}
                      {doctypeData.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Click "Load" to fetch sample data from {fieldConfig.options}
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              )}
          </div>

          {/* Preview Panel */}
          <div className="lg:col-span-2">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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

                  {/* Field Preview */}
                  <div className="max-w-2xl">
                    <FrappeField
                      field={buildFieldMeta()}
                      value={fieldValue}
                      onChange={(val) => setFieldValue(val)}
                      doctype={fieldConfig.options}
                    />
                  </div>

                  {/* Current Value Display */}
                  <div className="mt-6 p-4 bg-muted/20 rounded-lg">
                    <Label className="text-sm font-medium">Current Value:</Label>
                    <pre className="mt-2 text-xs bg-background p-3 rounded border overflow-auto">
                      {JSON.stringify(fieldValue, null, 2)}
                    </pre>
                  </div>
                </div>
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
  value={${JSON.stringify(fieldValue)}}
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

      {/* Table Row Editor Modal */}
      <TableRowEditor
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setEditingRow(null);
        }}
        doctype={fieldConfig.options || ""}
        rowData={editingRow || {}}
        onSave={handleTableRowSave}
        onDelete={editingRow ? handleTableRowDelete : undefined}
      />
    </BaseLayout>
  );
}