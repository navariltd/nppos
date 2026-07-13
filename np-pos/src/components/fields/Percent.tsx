"use client";

import { cn } from "@/lib/utils";
import * as React from "react";

interface PercentProps {
  value: number;
  onChange: (val: number) => void;
  onBlur?: () => void;
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

export const Percent = ({
  value = 0,
  onChange,
  onBlur,
  className = "",
  disabled = false,
  required = false,
  label,
  min = 0,
  max = 100,
  step = 1,
  decimals = 0,
  precision,
  nonNegative = false,
  length,
}: PercentProps) => {
  const [displayValue, setDisplayValue] = React.useState(
    value !== 0 ? value.toString() : "",
  );

  const effectiveMin = nonNegative ? Math.max(min, 0) : min;
  const effectiveMax = max;
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
      // Percent is always 0-100
      const clamped = Math.min(Math.max(num, effectiveMin), effectiveMax);
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
      <div className="relative">
        <input
          type="text"
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder="0"
        inputMode="decimal"
        maxLength={length}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 pr-8 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          %
        </span>
      </div>
    </div>
  );
};
