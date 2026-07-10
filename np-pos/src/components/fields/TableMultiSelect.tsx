"use client";

import { cn } from "@/lib/utils";
import { Check, ChevronDown, X } from "lucide-react";
import * as React from "react";

interface TableMultiSelectProps {
  value: string[];
  onChange: (val: string[]) => void;
  onBlur?: () => void;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  options: { label: string; value: string }[];
  placeholder?: string;
}

export const TableMultiSelect = ({
  value = [],
  onChange,
  onBlur,
  className = "",
  disabled = false,
  required = false,
  label,
  options = [],
  placeholder = "Select options...",
}: TableMultiSelectProps) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const selectedOptions = options.filter((opt) => value.includes(opt.value));

  const handleSelect = (optionValue: string) => {
    const newValue = value.includes(optionValue)
      ? value.filter((v) => v !== optionValue)
      : [...value, optionValue];
    onChange(newValue);
  };

  const removeOption = (optionValue: string) => {
    onChange(value.filter((v) => v !== optionValue));
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
        <div
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={cn(
            "flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          {selectedOptions.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : (
            selectedOptions.map((opt) => (
              <span
                key={opt.value}
                className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs"
              >
                {opt.label}
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeOption(opt.value);
                    }}
                    className="hover:text-destructive"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </span>
            ))
          )}
          <ChevronDown
            className={cn(
              "ml-auto size-4 opacity-50 transition-transform duration-200",
              isOpen && "rotate-180",
            )}
          />
        </div>
        {isOpen && !disabled && (
          <div className="absolute z-50 mt-1 w-full bg-popover border border-input rounded-md shadow-md overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100">
            <div className="max-h-60 overflow-y-auto p-1">
              {options.length === 0 ? (
                <div className="py-2 text-center text-sm text-muted-foreground">
                  No options available
                </div>
              ) : (
                options.map((option) => (
                  <div
                    key={option.value}
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      "relative flex w-full cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none transition-colors justify-between",
                      value.includes(option.value)
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                    {value.includes(option.value) && (
                      <Check className="size-4 text-primary shrink-0 ml-2" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
      {onBlur && <input type="hidden" onBlur={onBlur} />}
    </div>
  );
};
