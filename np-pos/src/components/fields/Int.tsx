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
  nonNegative?: boolean;
  precision?: number;
  length?: number;
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
  nonNegative = false,
  precision,
  length,
}: IntProps) => {
  const [displayValue, setDisplayValue] = React.useState(
    value !== 0 ? value.toString() : "",
  );

  const effectiveMin = nonNegative ? Math.max(min, 0) : min;
  const effectiveMax = max;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    
    // Strict validation: only allow empty string, minus sign, or valid integer
    if (val === "" || val === "-") {
      setDisplayValue(val);
      onChange(0);
      return;
    }
    
    // Only allow digits (no decimals, no letters, no special chars)
    if (!/^-?\d+$/.test(val)) {
      return; // Reject invalid input
    }
    
    const num = parseInt(val, 10);
    if (!isNaN(num)) {
      const clamped = Math.min(Math.max(num, effectiveMin), effectiveMax);
      setDisplayValue(clamped.toString());
      onChange(clamped);
    }
  };

  const handleBlur = () => {
    if (displayValue) {
      const num = parseInt(displayValue);
      if (!isNaN(num)) {
        const clamped = Math.min(Math.max(num, effectiveMin), effectiveMax);
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
        maxLength={length}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      />
    </div>
  );
};
