"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useFrappeGetCall, useFrappePostCall } from "frappe-react-sdk";
import { toast } from "sonner";

import { Skeleton } from "@/components/ui/skeleton";
import { useUser } from "@/contexts/user-context";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { FrappeFieldMeta } from "./types";
import { FormHeader } from "./form/FormHeader";
import { TabbedForm } from "./form/TabbedForm";

interface DocTypeFormProps {
  doctype: string;
  docname?: string;
  forceNew?: boolean;
  onSuccess?: (name: string) => void;
  onBack?: () => void;
}

function parseFrappeError(err: any): string {
  if (err?._server_messages) {
    try {
      const messages = JSON.parse(err._server_messages);
      if (Array.isArray(messages) && messages.length > 0) {
        const first = typeof messages[0] === "string" ? JSON.parse(messages[0]) : messages[0];
        return first?.message || first?.title || err?.message || "An error occurred";
      }
    } catch {}
  }
  if (err?.messages && Array.isArray(err.messages) && err.messages.length > 0) {
    return err.messages[0];
  }
  if (err?.exception) return err.exception;
  if (err?.message) return err.message;
  return "An error occurred";
}

type ConfirmAction = "submit" | "cancel" | null;

export function DocTypeForm({ doctype, docname: propDocname, forceNew = false, onSuccess, onBack }: DocTypeFormProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: routeId } = useParams();
  const [searchParams] = useSearchParams();
  const { user, isLoading: userLoading } = useUser();

  const isNew = forceNew || routeId === "new";
  const docId = propDocname || routeId;

  const [schemaFields, setSchemaFields] = useState<FrappeFieldMeta[]>([]);
  const [metaConfig, setMetaConfig] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [originalDoc, setOriginalDoc] = useState<any>(null);
  const [docstatus, setDocstatus] = useState(0);
  const [isSubmittable, setIsSubmittable] = useState(false);
  const [isLoadingDoc, setIsLoadingDoc] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [metaReady, setMetaReady] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [hasBeenSaved, setHasBeenSaved] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);

  const { data: schemaData, error: schemaError } = useFrappeGetCall(
    "frappe.desk.form.load.getdoctype", { doctype, with_parent: 1 },
    doctype ? `dtf-meta-${doctype}` : null,
  );

  const { data: docData, error: docError } = useFrappeGetCall(
    "frappe.desk.form.load.getdoc", { doctype, name: docId },
    doctype && docId && !isNew ? `dtf-doc-${doctype}-${docId}` : null,
  );

  const { call: updateDoc } = useFrappePostCall("frappe.client.save");
  const { call: saveDocs } = useFrappePostCall("frappe.desk.form.save.savedocs");

  useEffect(() => {
    if (schemaError) { const e = schemaError as any; setError(parseFrappeError(e)); toast.error(parseFrappeError(e)); return; }
    if (schemaData?.message?.docs?.length || schemaData?.docs?.length) {
      const docs = schemaData.message?.docs ?? schemaData.docs ?? [];
      const meta = docs.find((d: any) => d.name === doctype) ?? docs[0];
      if (meta) {
        setSchemaFields((meta.fields ?? []).map((f: any) => ({ ...f, required: f.reqd || f.required, read_only: f.read_only })));
        setMetaConfig(meta);
        setIsSubmittable(meta.is_submittable === 1);
      }
      setMetaReady(true);
    }
  }, [schemaData, schemaError, doctype]);

  const routeOptions = useMemo(() => {
    const opts: Record<string, string> = {};
    const stateRouteOptions = (location.state as any)?.routeOptions;
    if (stateRouteOptions && typeof stateRouteOptions === "object") {
      for (const [key, value] of Object.entries(stateRouteOptions)) {
        opts[key] = String(value ?? "");
      }
    }
    for (const [key, value] of searchParams.entries()) {
      opts[key] = value;
    }
    return opts;
  }, [location.state, searchParams]);

  useEffect(() => {
    if (!isNew || !metaReady || !schemaFields.length) return;
    const routeOpts = routeOptions;
    const keys = Object.keys(routeOpts);
    if (keys.length === 0) return;
    const prefill: Record<string, any> = {};
    let hasAny = false;
    keys.forEach((key) => {
      const df = schemaFields.find((f: any) => f.fieldname === key);
      if (!df) return;
      if (df.no_copy) return;
      if (key.startsWith("__") || key === "name" || key === "doctype") return;
      let value: any = routeOpts[key];
      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) return;
          if (typeof parsed === "object" && parsed !== null) value = parsed;
        } catch {}
      }
      prefill[key] = value;
      hasAny = true;
    });
    if (hasAny) {
      setForm((prev) => ({ ...prev, ...prefill }));
      setOriginalDoc(JSON.parse(JSON.stringify({ ...prefill })));
    }
  }, [isNew, metaReady, schemaFields, routeOptions]);

  useEffect(() => {
    if (isNew && metaReady) {
      if (Object.keys(routeOptions).length === 0) {
        setForm({}); setOriginalDoc(null); setDocstatus(0); setIsEditing(true); setIsLoadingDoc(false);
      }
      return;
    }
    if (docError) { const e = docError as any; setError(parseFrappeError(e)); toast.error(parseFrappeError(e)); setIsLoadingDoc(false); return; }
    if (docData) {
      const doc = docData?.message?.docs?.[0] ?? docData?.docs?.[0] ?? {};
      if (doc.name) { setForm(doc); setOriginalDoc(JSON.parse(JSON.stringify(doc))); setDocstatus(doc.docstatus ?? 0); setIsEditing(false); setHasBeenSaved(true); }
      setIsLoadingDoc(false);
    }
  }, [docData, docError, isNew, metaReady, routeOptions]);

  useEffect(() => {
    if (isNew && metaReady && isLoadingDoc) {
      setIsLoadingDoc(false);
      setIsEditing(true);
    }
  }, [isNew, metaReady, isLoadingDoc]);

  useEffect(() => {
    if (isNew) { setIsEditing(true); return; }
    if (originalDoc) {
      const isDirty = JSON.stringify(form) !== JSON.stringify(originalDoc);
      setIsEditing(isDirty);
      if (isDirty && hasBeenSaved) setHasBeenSaved(false);
    }
  }, [form, originalDoc, isNew, hasBeenSaved]);

  const handleChange = (value: any, fieldname?: string) => { if (!fieldname) return; setForm((p) => ({ ...p, [fieldname]: value })); };

  const handleSave = async () => {
    if (!doctype) return;
    setIsSaving(true); setError(null);
    try {
      const cleaned = { ...form };
      if (isNew) { delete cleaned.name; delete cleaned.creation; delete cleaned.modified; delete cleaned.modified_by; delete cleaned.owner; delete cleaned.docstatus; delete cleaned.idx; }
      const res: any = await updateDoc({ doc: { doctype, name: !isNew ? docId : undefined, ...cleaned } });
      const saved = res?.message ?? res?.docs?.[0] ?? res;
      if (saved?.name) {
        setForm(saved); setOriginalDoc(JSON.parse(JSON.stringify(saved))); setDocstatus(saved.docstatus ?? 0); setIsEditing(false); setHasBeenSaved(true);
        toast.success(`${doctype} saved successfully${isNew ? ` as ${saved.name}` : ""}`);
        if (isNew) navigate(`/app/${doctype.toLowerCase().replace(/ /g, "-")}/${saved.name}`, { replace: true });
        onSuccess?.(saved.name);
      }
    } catch (err: any) { const msg = parseFrappeError(err); setError(msg); toast.error(msg); }
    finally { setIsSaving(false); }
  };

  const handleSubmit = async () => {
    if (!doctype || !docId) return;
    setConfirmAction(null);
    setIsSubmitting(true); setError(null);
    try {
      const res: any = await saveDocs({ doc: JSON.stringify({ ...form, doctype, name: docId, docstatus: 1 }), action: "Submit" });
      const d = res?.docs?.[0] ?? res?.message?.docs?.[0];
      if (d) { setForm(d); setDocstatus(1); toast.success(`${doctype} submitted successfully`); onSuccess?.(docId); }
    } catch (err: any) { const msg = parseFrappeError(err); setError(msg); toast.error(msg); }
    finally { setIsSubmitting(false); }
  };

  const handleCancel = async () => {
    if (!doctype || !docId) return;
    setConfirmAction(null);
    setIsCancelling(true); setError(null);
    try { const res: any = await saveDocs({ doctype, name: docId, action: "Cancel" }); if (res?.docs?.[0]) { setForm(res.docs[0]); setDocstatus(2); toast.success(`${doctype} cancelled successfully`); } }
    catch (err: any) { const msg = parseFrappeError(err); setError(msg); toast.error(msg); }
    finally { setIsCancelling(false); }
  };

  const handleDuplicate = useCallback(() => {
    const a: Record<string, any> = { ...form };
    delete a.name; delete a.creation; delete a.modified; delete a.modified_by; delete a.owner; delete a.docstatus; delete a.idx;
    delete a.amended_from;
    navigate(`/app/${doctype.toLowerCase().replace(/ /g, "-")}/new`, { state: { routeOptions: a } });
  }, [form, doctype, navigate]);

  const handleAmend = () => {
    const a: Record<string, any> = { ...form, amended_from: docId };
    delete a.name; delete a.creation; delete a.modified; delete a.modified_by; delete a.owner; delete a.docstatus; delete a.idx;
    setForm(a);
    navigate(`/app/${doctype.toLowerCase().replace(/ /g, "-")}/new`);
  };

  const handleBack = () => { if (onBack) onBack(); else navigate(`/app/${doctype.toLowerCase().replace(/ /g, "-")}`); };

  useEffect(() => {
    if (!metaReady || !schemaFields.length) return;
    const collapsed: Record<string, boolean> = {};
    schemaFields.forEach((f: any) => {
      if (f.fieldtype === "Section Break" && f.collapsible) {
        collapsed[f.fieldname] = f.collapsed !== 0;
      }
    });
    setCollapsedSections(collapsed);
  }, [metaReady, schemaFields]);

  const toggleSection = (fn: string) => setCollapsedSections((p) => ({ ...p, [fn]: !p[fn] }));

  if (userLoading || !metaReady) return <div className="px-4 lg:px-6 space-y-6 pb-8"><Skeleton className="h-10 w-20" /><Skeleton className="h-8 w-48" /><div className="space-y-4"><Skeleton className="h-[200px] w-full rounded-lg" /><Skeleton className="h-[300px] w-full rounded-lg" /></div></div>;
  if (!metaConfig) return <div className="px-4 lg:px-6 text-center py-20 text-muted-foreground">Failed to load configuration.</div>;

  return (
    <div className="px-4 lg:px-6 space-y-6 pb-8">
      <FormHeader isNew={isNew} metaConfig={metaConfig} form={form} docId={docId}
        docstatus={docstatus} isBusy={isSaving || isSubmitting || isCancelling}
        isEditing={isEditing} isSubmittable={isSubmittable}
        savedName={null} error={error}
        isSaving={isSaving} isSubmitting={isSubmitting} isCancelling={isCancelling}
        hasBeenSaved={hasBeenSaved}
        onBack={handleBack} onReset={() => { setForm(JSON.parse(JSON.stringify(originalDoc))); setIsEditing(false); setError(null); }}
        onSave={handleSave}
        onSubmit={() => setConfirmAction("submit")}
        onCancel={() => setConfirmAction("cancel")}
        onAmend={handleAmend} onDuplicate={docstatus === 0 && !isNew ? handleDuplicate : undefined} />

      <TabbedForm schemaFields={schemaFields} form={form} doctype={doctype}
        docData={docData} metaConfig={metaConfig}
        isReadOnly={docstatus !== 0}
        isNew={isNew} isLoadingDoc={isLoadingDoc}
        onFieldChange={handleChange}
        collapsedSections={collapsedSections} onToggleSection={toggleSection}
        reloadData={handleSave as any} />

      <AlertDialog open={confirmAction === "submit"} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit {metaConfig?.name || doctype}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to submit this document? Once submitted, it cannot be edited.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmAction === "cancel"} onOpenChange={(open) => { if (!open) setConfirmAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {metaConfig?.name || doctype}</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this document? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, keep it</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleCancel} disabled={isCancelling}>
              {isCancelling ? "Cancelling..." : "Yes, cancel"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default DocTypeForm;