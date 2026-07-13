"use client";

import { cn } from "@/lib/utils";
import { Check, ChevronDown } from "lucide-react";
import * as React from "react";

interface SelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  onChange: (val: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  options: SelectOption[];
  length?: number;
}

export const Select = ({
  value = "",
  onChange,
  onBlur,
  placeholder = "Select option...",
  className = "",
  disabled = false,
  required = false,
  label,
  options = [],
  length,
}: SelectProps) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const selectedOption = options.find((opt) => opt.value === value);

  const handleSelect = (option: SelectOption) => {
    if (!option.disabled) {
      onChange(option.value);
      setIsOpen(false);
      onBlur?.();
    }
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
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
          disabled={disabled}
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            !selectedOption && "text-muted-foreground",
          )}
        >
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <ChevronDown
            className={cn(
              "size-4 opacity-50 transition-transform duration-200",
              isOpen && "rotate-180",
            )}
          />
        </button>
        {isOpen && (
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
                    onClick={() => handleSelect(option)}
                    className={cn(
                      "relative flex w-full cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none transition-colors justify-between",
                      option.disabled && "opacity-50 cursor-not-allowed",
                      option.value === value
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                    {option.value === value && (
                      <Check className="size-4 text-primary shrink-0 ml-2" />
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
