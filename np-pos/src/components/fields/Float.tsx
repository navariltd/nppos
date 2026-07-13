"use client";

import { cn } from "@/lib/utils";
import * as React from "react";

interface FloatProps {
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
  decimals?: number;
  precision?: number;
  nonNegative?: boolean;
  length?: number;
}

export const Float = ({
  value = 0,
  onChange,
  onBlur,
  placeholder = "0.00",
  className = "",
  disabled = false,
  required = false,
  label,
  min = -Infinity,
  max = Infinity,
  step = 0.01,
  decimals = 2,
  precision,
  nonNegative = false,
  length,
}: FloatProps) => {
  const [displayValue, setDisplayValue] = React.useState(
    value ? value.toFixed(decimals) : "",
  );

  const effectiveMin = nonNegative ? Math.max(min, 0) : min;
  const effectiveDecimals = precision !== undefined ? precision : decimals;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDisplayValue(val);
    
    // Strict validation: only allow empty string, minus sign, decimal point, or valid float
    if (val === "" || val === "-" || val === "." || val === "-.") {
      onChange(0);
      return;
    }
    
    // Only allow valid float format (optional minus, digits, optional decimal with digits)
    if (!/^-?\d*\.?\d*$/.test(val)) {
      return; // Reject invalid input
    }
    
    const num = parseFloat(val);
    if (!isNaN(num)) {
      const clamped = Math.min(Math.max(num, effectiveMin), max);
      const rounded = parseFloat(clamped.toFixed(effectiveDecimals));
      onChange(rounded);
    }
  };

  const handleBlur = () => {
    if (displayValue) {
      const num = parseFloat(displayValue);
      if (!isNaN(num)) {
        const clamped = Math.min(Math.max(num, effectiveMin), max);
        setDisplayValue(clamped.toFixed(effectiveDecimals));
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
        inputMode="decimal"
        maxLength={length}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      />
    </div>
  );
};
