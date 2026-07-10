"use client";

import { cn } from "@/lib/utils";
import * as React from "react";

interface IntProps {
  value: number;
  onChange: (val: number) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  min?: number;
  max?: number;
  step?: number;
}

export const Int = ({
  value = 0,
  onChange,
  onBlur,
  placeholder = "0",
  className = "",
  disabled = false,
  required = false,
  label,
  min = -Infinity,
  max = Infinity,
  step = 1,
}: IntProps) => {
  const [displayValue, setDisplayValue] = React.useState(
    value !== 0 ? value.toString() : "",
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDisplayValue(val);
    if (val === "" || val === "-") {
      onChange(0);
      return;
    }
    const num = parseInt(val);
    if (!isNaN(num)) {
      const clamped = Math.min(Math.max(num, min), max);
      onChange(clamped);
    }
  };

  const handleBlur = () => {
    if (displayValue) {
      const num = parseInt(displayValue);
      if (!isNaN(num)) {
        const clamped = Math.min(Math.max(num, min), max);
        setDisplayValue(clamped.toString());
        onChange(clamped);
      }
    }
    onBlur?.();
  };

  return (
    <div className={cn("w-full flex flex-col gap-1.5", className)}>
      {label && (
        <label className="text-sm font-medium text-foreground flex items-center gap-0.5 select-none">
          {label}
          {required && (
            <span className="text-destructive font-bold text-red-500 ml-0.5">
              *
            </span>
          )}
        </label>
      )}
      <input
        type="text"
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder={placeholder}
        inputMode="numeric"
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      />
    </div>
  );
};
