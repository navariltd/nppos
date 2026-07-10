"use client";

import { cn } from "@/lib/utils";
import { Check, ChevronDown, Loader2, Search, X } from "lucide-react";
import * as React from "react";
import { createPortal } from "react-dom";

export interface AutocompleteOption {
  label: string;
  value: string;
  extra?: any;
  description?: string;
  avatar?: string;
  icon?: React.ReactNode;
  metadata?: Record<string, any>;
}

interface AutocompleteProps {
  options: AutocompleteOption[];
  value: string;
  onChange: (val: string, option?: AutocompleteOption) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  clearable?: boolean;
  loading?: boolean;
  required?: boolean;
  label?: string;
  onSearch?: (search: string) => void;
  debounceDelay?: number;
}

export const Autocomplete = ({
  options = [],
  value,
  onChange,
  onBlur,
  placeholder,
  className = "",
  disabled = false,
  clearable = true,
  loading = false,
  required = false,
  label,
  onSearch,
  debounceDelay = 300,
}: AutocompleteProps) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  const [dropdownPosition, setDropdownPosition] = React.useState<
    "top" | "bottom"
  >("bottom");

  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const buttonRef = React.useRef<HTMLDivElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const searchTimeoutRef = React.useRef<any>(null);
  const isSelectingRef = React.useRef(false);

  const handleOpen = React.useCallback(() => {
    if (disabled || isSelectingRef.current) return;
    setIsOpen(!isOpen);
    if (!isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [disabled, isOpen]);

  const handleSearch = React.useCallback(
    (val: string) => {
      setSearch(val);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      searchTimeoutRef.current = setTimeout(() => {
        onSearch?.(val);
      }, debounceDelay);
    },
    [onSearch, debounceDelay],
  );

  const handleSelect = React.useCallback(
    (opt: AutocompleteOption) => {
      isSelectingRef.current = true;
      onChange(opt.value, opt);
      setIsOpen(false);
      setSearch("");
      setHighlightedIndex(-1);
      setTimeout(() => {
        isSelectingRef.current = false;
      }, 200);
    },
    [onChange],
  );

  const handleClear = React.useCallback(() => {
    isSelectingRef.current = true;
    onChange("", undefined);
    setSearch("");
    setIsOpen(false);
    setTimeout(() => {
      isSelectingRef.current = false;
    }, 200);
  }, [onChange]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === "ArrowDown" || e.key === "Enter") {
          e.preventDefault();
          handleOpen();
        }
        return;
      }
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < options.length - 1 ? prev + 1 : prev,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
          break;
        case "Enter":
          e.preventDefault();
          if (highlightedIndex >= 0 && options[highlightedIndex]) {
            handleSelect(options[highlightedIndex]);
          }
          break;
        case "Escape":
          setIsOpen(false);
          setSearch("");
          setHighlightedIndex(-1);
          break;
      }
    },
    [isOpen, options, highlightedIndex, handleSelect, handleOpen],
  );

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(e.target as Node)
        ) {
          setIsOpen(false);
          setSearch("");
          setHighlightedIndex(-1);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  React.useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      if (
        window.innerHeight - rect.bottom < 320 &&
        rect.top > window.innerHeight - rect.bottom
      ) {
        setDropdownPosition("top");
      } else {
        setDropdownPosition("bottom");
      }
    }
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value);
  const displayLabel = label;

  const dropdown =
    isOpen && !disabled ? (
      <div
        ref={dropdownRef}
        style={{
          position: "fixed",
          top:
            dropdownPosition === "bottom" && buttonRef.current
              ? buttonRef.current.getBoundingClientRect().bottom + 4
              : undefined,
          bottom:
            dropdownPosition === "top" && buttonRef.current
              ? window.innerHeight -
                buttonRef.current.getBoundingClientRect().top +
                4
              : undefined,
          left: buttonRef.current
            ? buttonRef.current.getBoundingClientRect().left
            : 0,
          width: buttonRef.current
            ? buttonRef.current.getBoundingClientRect().width
            : 300,
          zIndex: 999999,
        }}
        className="bg-popover border border-input text-popover-foreground rounded-md shadow-md overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100"
      >
        <div className="p-1 border-b border-border">
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 size-4 opacity-50" />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent pl-8 pr-8 py-1.5 text-sm rounded-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Type to search..."
            />
            {loading && (
              <Loader2 className="absolute right-2.5 size-4 animate-spin opacity-50" />
            )}
          </div>
        </div>
        <div className="max-h-60 overflow-y-auto p-1">
          {loading && options.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Searching...
            </div>
          ) : options.length > 0 ? (
            options.map((opt, idx) => (
              <div
                key={opt.value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSelect(opt);
                }}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={cn(
                  "relative flex w-full cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none select-none transition-colors justify-between",
                  highlightedIndex === idx
                    ? "bg-accent text-accent-foreground"
                    : "",
                  opt.value === value ? "bg-accent/50" : "",
                )}
              >
                <div className="flex flex-col min-w-0 w-full py-0.5">
                  <span className="font-medium text-foreground truncate">
                    {opt.label}
                  </span>
                  {opt.description && (
                    <span className="text-xs text-muted-foreground truncate">
                      {opt.description}
                    </span>
                  )}
                </div>
                {opt.value === value && (
                  <Check className="size-4 text-primary shrink-0 ml-2" />
                )}
              </div>
            ))
          ) : (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No results found
            </div>
          )}
        </div>
      </div>
    ) : null;

  return (
    <div
      ref={containerRef}
      onBlur={(e) => {
        if (
          !containerRef.current?.contains(e.relatedTarget as Node) &&
          !isSelectingRef.current
        ) {
          onBlur?.();
        }
      }}
      className={cn("relative w-full flex flex-col gap-1.5", className)}
    >
      {displayLabel && (
        <label className="text-sm font-medium text-foreground flex items-center gap-0.5 select-none">
          {displayLabel}
          {required && (
            <span className="text-destructive font-bold text-red-500 ml-0.5">
              *
            </span>
          )}
        </label>
      )}
      <div
        ref={buttonRef}
        onClick={handleOpen}
        className={cn(
          "border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none cursor-pointer",
          disabled && "opacity-50 cursor-not-allowed",
          isOpen && "ring-[3px] ring-ring/50 border-ring",
        )}
      >
        <span
          className={cn("truncate", !selectedOption && "text-muted-foreground")}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {clearable && selectedOption && value && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="p-0.5 hover:bg-accent rounded text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
          <ChevronDown
            className={cn(
              "size-4 opacity-50 transition-transform duration-200",
              isOpen && "rotate-180",
            )}
          />
        </div>
      </div>
      {typeof window !== "undefined" && createPortal(dropdown, document.body)}
    </div>
  );
};
