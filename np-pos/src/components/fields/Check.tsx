"use client";

import { cn } from "@/lib/utils";
import { Check as CheckIcon } from "lucide-react";

interface CheckProps {
  value: boolean;
  onChange: (val: boolean) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  length?: number;
}

export const Check = ({
  value = false,
  onChange,
  onBlur,
  placeholder,
  className = "",
  disabled = false,
  required = false,
  label,
  length,
}: CheckProps) => {
  const isChecked = value;

  return (
    <div className={cn("w-full flex flex-col gap-1.5", className)}>
      <label className="flex items-center gap-2 text-sm font-medium text-foreground select-none cursor-pointer">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) => onChange(e.target.checked)}
          onBlur={onBlur}
          disabled={disabled}
          className="sr-only"
        />
        <span
          className={cn(
            "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-primary transition-colors",
            isChecked && "bg-primary text-primary-foreground",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          {isChecked && <CheckIcon className="size-3" />}
        </span>
        {label && (
          <span className="text-sm font-medium">
            {label}
            {required && (
              <span className="text-destructive font-bold text-red-500 ml-0.5">
                *
              </span>
            )}
          </span>
        )}
      </label>
    </div>
  );
};
