/** Form header with back button, title, status badge, and action buttons. */

import { ArrowLeft, CheckCircle, Loader2, Save, Send, Undo2, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DOCSTATUS_MAP } from "../types";

interface FormHeaderProps {
  isNew: boolean;
  metaConfig: any;
  form: Record<string, any>;
  docId?: string;
  docstatus: number;
  isBusy: boolean;
  isEditing: boolean;
  isSubmittable: boolean;
  savedName: string | null;
  error: string | null;
  isSaving: boolean;
  isSubmitting: boolean;
  isCancelling: boolean;
  hasBeenSaved?: boolean;
  onBack: () => void;
  onReset: () => void;
  onSave: () => void;
  onSubmit: () => void;
  onCancel: () => void;
  onAmend: () => void;
  onDuplicate?: () => void;
}

export function FormHeader({
  isNew, metaConfig, form, docId, docstatus, isBusy, isEditing, isSubmittable,
  savedName, error, isSaving, isSubmitting, isCancelling, hasBeenSaved = false,
  onBack, onReset, onSave, onSubmit, onCancel, onAmend, onDuplicate,
}: FormHeaderProps) {
  const status = DOCSTATUS_MAP[docstatus] ?? { label: "Unknown", variant: "outline" as const };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0"><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{isNew ? `New ${metaConfig.name}` : form?.title || docId}</h1>
              {!isNew && <Badge variant={status.variant as any}>{status.label}</Badge>}
            </div>
            <p className="text-muted-foreground text-sm">{metaConfig.name}{form?.owner && !isNew && ` · Created by ${form.owner}`}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* New doc: just Save */}
          {isNew && (
            <Button size="sm" onClick={onSave} disabled={isBusy} className="gap-1">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
          )}

          {/* Existing draft doc: Save when editing, Submit when saved */}
          {docstatus === 0 && !isNew && (
            <>
              {/* Dirty/editing: show Reset + Save */}
              {isEditing && (
                <>
                  <Button variant="outline" size="sm" onClick={onReset} disabled={isBusy} className="gap-1">
                    <Undo2 className="h-4 w-4" />Reset
                  </Button>
                  <Button size="sm" onClick={onSave} disabled={isBusy} className="gap-1">
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save
                  </Button>
                </>
              )}

              {/* Saved and not editing: show Submit if submittable */}
              {!isEditing && isSubmittable && hasBeenSaved && (
                <Button size="sm" onClick={onSubmit} disabled={isBusy} className="gap-1">
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Submit
                </Button>
              )}
            </>
          )}

          {/* Submitted: Cancel */}
          {isSubmittable && docstatus === 1 && (
            <Button variant="destructive" size="sm" onClick={onCancel} disabled={isBusy} className="gap-1">
              {isCancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Cancel
            </Button>
          )}

          {/* Cancelled: Amend */}
          {docstatus === 2 && (
            <Button variant="outline" size="sm" onClick={onAmend} disabled={isBusy} className="gap-1">
              <Undo2 className="h-4 w-4" />Amend
            </Button>
          )}
        </div>
      </div>

      {savedName && <div className="p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm flex items-center gap-2"><CheckCircle className="h-4 w-4" />Saved as {savedName}</div>}
      {error && <div className="p-3 bg-destructive/10 border border-destructive/20 text-destructive rounded-md text-sm flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
    </>
  );
}