"use client";

import { cn } from "@/lib/utils";
import * as React from "react";

interface CurrencyProps {
  value: number;
  onChange: (val: number) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  currency?: string;
  decimals?: number;
}

export const Currency = ({
  value = 0,
  onChange,
  onBlur,
  placeholder = "0.00",
  className = "",
  disabled = false,
  required = false,
  label,
  currency = "$",
  decimals = 2,
}: CurrencyProps) => {
  const [displayValue, setDisplayValue] = React.useState(value.toString());

  const formatValue = (val: string) => {
    const num = parseFloat(val);
    if (isNaN(num)) return "";
    return num.toFixed(decimals);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDisplayValue(val);
    const num = parseFloat(val);
    if (!isNaN(num)) {
      onChange(num);
    } else if (val === "" || val === "-") {
      onChange(0);
    }
  };

  const handleBlur = () => {
    if (displayValue) {
      const formatted = formatValue(displayValue);
      setDisplayValue(formatted);
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
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {currency}
        </span>
        <input
          type="text"
          value={displayValue}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={placeholder}
          inputMode="decimal"
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 pl-8 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
        />
      </div>
    </div>
  );
};
