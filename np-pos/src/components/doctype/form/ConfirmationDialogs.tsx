/**
 * ConfirmationDialogs – reusable AlertDialog components for submit and cancel actions.
 *
 * Key dependencies: shadcn/ui AlertDialog, used by DocTypeForm for submit/cancel confirmation.
 */

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

interface ConfirmSubmitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctypeLabel: string;
  isSubmitting: boolean;
  onConfirm: () => void;
}

/** Dialog confirming submission of a document. */
export function ConfirmSubmitDialog({
  open,
  onOpenChange,
  doctypeLabel,
  isSubmitting,
  onConfirm,
}: ConfirmSubmitDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Submit {doctypeLabel}</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to submit this document? Once submitted, it cannot be edited.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface ConfirmCancelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  doctypeLabel: string;
  isCancelling: boolean;
  onConfirm: () => void;
}

/** Dialog confirming cancellation of a submitted document. */
export function ConfirmCancelDialog({
  open,
  onOpenChange,
  doctypeLabel,
  isCancelling,
  onConfirm,
}: ConfirmCancelDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel {doctypeLabel}</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to cancel this document? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>No, keep it</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm} disabled={isCancelling}>
            {isCancelling ? "Cancelling..." : "Yes, cancel"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}