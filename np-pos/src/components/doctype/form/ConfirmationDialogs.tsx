/** AlertDialog components for submit confirmation, cancel confirmation, and error display. */

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
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