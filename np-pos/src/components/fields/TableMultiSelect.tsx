"use client";

import { callPost } from "@/lib/frappe-service";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Loader2,
  Search,
  X,
} from "lucide-react";
import * as React from "react";
import { createPortal } from "react-dom";

export interface AutoCompleteOption {
  label: string;
  value: string;
  extra?: any;
  description?: string;
  avatar?: string;
  icon?: React.ReactNode;
  metadata?: Record<string, any>;
}

interface TableMultiSelectProps {
  doctype: string;
  value: string[];
  onChange: (val: string[]) => void;
  onBlur?: () => void;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  placeholder?: string;
  linkFieldname?: string;
  filters?: Record<string, any>;
  query?: string;
  debounceDelay?: number;
  pageLength?: number;
}

export const TableMultiSelect = ({
  doctype,
  value = [],
  onChange,
  onBlur,
  className = "",
  disabled = false,
  required = false,
  label,
  placeholder = "Select options...",
  linkFieldname,
  filters = {},
  query,
  debounceDelay = 300,
  pageLength = 20,
}: TableMultiSelectProps) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [options, setOptions] = React.useState<AutoCompleteOption[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [dropdownPosition, setDropdownPosition] = React.useState<
    "top" | "bottom"
  >("bottom");
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);
  const [docMeta, setDocMeta] = React.useState<any>(null);
  const [hasLoadedMeta, setHasLoadedMeta] = React.useState(false);
  const [metaLoading, setMetaLoading] = React.useState(false);
  const [linkDoctype, setLinkDoctype] = React.useState<string>("");
  const [errorMessage, setErrorMessage] = React.useState<string>("");
  const [selectedDisplayValues, setSelectedDisplayValues] = React.useState<
    { label: string; value: string }[]
  >([]);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const buttonRef = React.useRef<HTMLDivElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const searchTimeoutRef = React.useRef<any>(null);
  const isSelectingRef = React.useRef(false);
  const hasFetchedOnceRef = React.useRef(false);
  const lastSearchedTxtRef = React.useRef<string | null>(null);
  const activeRequestIdRef = React.useRef<number>(0);
  const currentPageLengthRef = React.useRef<number>(pageLength);
  const hasMoreRef = React.useRef<boolean>(true);
  const isFetchingMoreRef = React.useRef<boolean>(false);

  const { post: fetchDocType } = callPost("frappe.desk.form.load.getdoctype");
  const { post: searchLink } = callPost("frappe.desk.search.search_link");

  const prevFiltersRef = React.useRef(filters);

  React.useEffect(() => {
    if (JSON.stringify(prevFiltersRef.current) !== JSON.stringify(filters)) {
      hasFetchedOnceRef.current = false;
      lastSearchedTxtRef.current = null;
      setOptions([]);
      prevFiltersRef.current = filters;
    }
  }, [filters]);

  React.useEffect(() => {
    const loadMeta = async () => {
      if (!doctype || hasLoadedMeta) return;

      try {
        setMetaLoading(true);
        setErrorMessage("");

        const response = await fetchDocType({
          doctype: doctype,
          with_parent: 0,
        });

        if (response && (response as any).docs && (response as any).docs[0]) {
          const meta = (response as any).docs[0];
          setDocMeta(meta);

          const fields: any[] = meta.fields || [];
          let linkField: any = null;

          if (linkFieldname) {
            linkField = fields.find(
              (f: any) =>
                f.fieldname === linkFieldname && f.fieldtype === "Link",
            );
          }

          if (!linkField) {
            linkField = fields.find(
              (f: any) => f.fieldtype === "Link" && f.reqd === 1,
            );
          }

          if (!linkField) {
            linkField = fields.find((f: any) => f.fieldtype === "Link");
          }

          if (linkField) {
            setLinkDoctype(linkField.options || "");
          } else {
            setLinkDoctype("");
            setErrorMessage(
              `"${doctype}" has no Link field. TableMultiSelect requires at least one Link field to work.`,
            );
          }
        }
        setHasLoadedMeta(true);
      } catch (error) {
        console.error(error);
        setErrorMessage("Failed to load doctype metadata.");
      } finally {
        setMetaLoading(false);
      }
    };

    loadMeta();
  }, [doctype, hasLoadedMeta, linkFieldname, fetchDocType]);

  React.useEffect(() => {
    const fetchLabels = async () => {
      if (
        !linkDoctype ||
        value.length === 0 ||
        selectedDisplayValues.length > 0
      )
        return;
      try {
        const response = await searchLink({
          txt: "",
          doctype: linkDoctype,
          page_length: value.length,
          filters: JSON.stringify({ name: ["in", value] }),
        });
        const results: AutoCompleteOption[] = (
          (response as any)?.message || []
        ).map((opt: any) => ({
          label: opt.label || opt.value,
          value: opt.value,
          description: opt.description || "",
        }));
        setSelectedDisplayValues(
          value.map((v) => {
            const found = results.find((r) => r.value === v);
            return { label: found?.label || v, value: v };
          }),
        );
      } catch {
        setSelectedDisplayValues(value.map((v) => ({ label: v, value: v })));
      }
    };
    fetchLabels();
  }, [linkDoctype, value, searchLink]);

  const performSearch = React.useCallback(
    async (searchTerm: string, limit: number, append = false) => {
      if (!linkDoctype) return;
      if (searchTimeoutRef.current && !append) {
        clearTimeout(searchTimeoutRef.current);
      }

      if (append) {
        if (isFetchingMoreRef.current || !hasMoreRef.current) return;
        isFetchingMoreRef.current = true;
      } else {
        activeRequestIdRef.current += 1;
        setLoading(true);
        hasMoreRef.current = true;
      }

      const currentRequestId = activeRequestIdRef.current;

      const executeFetch = async () => {
        try {
          if (currentRequestId !== activeRequestIdRef.current) return;

          const response = await searchLink({
            txt: searchTerm,
            doctype: linkDoctype,
            reference_doctype: doctype,
            page_length: limit,
            query: query || undefined,
            filters: JSON.stringify(filters),
          });

          if (currentRequestId !== activeRequestIdRef.current) return;

          const message = (response as any)?.message || [];
          const results = message.map((opt: any) => ({
            label: opt.label || opt.value,
            value: opt.value,
            description: opt.description || "",
            extra: opt.extra,
          }));

          if (results.length < limit) {
            hasMoreRef.current = false;
          } else {
            hasMoreRef.current = true;
          }

          if (!isSelectingRef.current) {
            if (append) {
              setOptions((prev) => {
                const existingValues = new Set(prev.map((o) => o.value));
                const filteredNew = results.filter(
                  (o: any) => !existingValues.has(o.value),
                );
                return [...prev, ...filteredNew];
              });
            } else {
              setOptions(results);
              lastSearchedTxtRef.current = searchTerm;
            }
          }
        } catch (error) {
          if (currentRequestId === activeRequestIdRef.current) {
            console.error(error);
          }
        } finally {
          if (currentRequestId === activeRequestIdRef.current) {
            if (append) {
              isFetchingMoreRef.current = false;
            } else {
              setLoading(false);
            }
          }
        }
      };

      if (append) {
        executeFetch();
      } else {
        searchTimeoutRef.current = setTimeout(executeFetch, debounceDelay);
      }
    },
    [linkDoctype, doctype, query, filters, debounceDelay, searchLink],
  );

  const handleOpen = React.useCallback(() => {
    if (disabled || !linkDoctype || metaLoading || isSelectingRef.current)
      return;

    const nextOpen = !isOpen;
    setIsOpen(nextOpen);

    if (nextOpen) {
      if (!hasFetchedOnceRef.current) {
        hasFetchedOnceRef.current = true;
        lastSearchedTxtRef.current = "";
        currentPageLengthRef.current = pageLength;
        performSearch("", pageLength);
      }
    }
  }, [disabled, linkDoctype, metaLoading, isOpen, performSearch, pageLength]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);

    if (val !== lastSearchedTxtRef.current) {
      currentPageLengthRef.current = pageLength;
      performSearch(val, pageLength);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 15) {
      if (
        options.length >= pageLength &&
        hasMoreRef.current &&
        !isFetchingMoreRef.current
      ) {
        currentPageLengthRef.current += pageLength;
        performSearch(search, currentPageLengthRef.current, true);
      }
    }
  };

  React.useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

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
          lastSearchedTxtRef.current = null;
          setHighlightedIndex(-1);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  React.useEffect(() => {
    if (isOpen && inputRef.current && !isSelectingRef.current) {
      inputRef.current.focus();
      if (buttonRef.current) {
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
    }
  }, [isOpen]);

  const handleSelect = React.useCallback(
    (opt: AutoCompleteOption) => {
      isSelectingRef.current = true;
      const newValue = value.includes(opt.value)
        ? value.filter((v) => v !== opt.value)
        : [...value, opt.value];
      const newDisplay = value.includes(opt.value)
        ? selectedDisplayValues.filter((v) => v.value !== opt.value)
        : [...selectedDisplayValues, { label: opt.label, value: opt.value }];

      onChange(newValue);
      setSelectedDisplayValues(newDisplay);
      setSearch("");
      lastSearchedTxtRef.current = null;
      setHighlightedIndex(-1);

      setTimeout(() => {
        isSelectingRef.current = false;
        inputRef.current?.focus();
      }, 200);
    },
    [value, onChange, selectedDisplayValues],
  );

  const handleRemove = React.useCallback(
    (optionValue: string) => {
      onChange(value.filter((v) => v !== optionValue));
      setSelectedDisplayValues(
        selectedDisplayValues.filter((v) => v.value !== optionValue),
      );
    },
    [value, onChange, selectedDisplayValues],
  );

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
          lastSearchedTxtRef.current = null;
          setHighlightedIndex(-1);
          break;
      }
    },
    [isOpen, options, highlightedIndex, handleSelect, handleOpen],
  );

  const getSubtitles = (opt: AutoCompleteOption) => {
    const subtitles: string[] = [];

    if (docMeta) {
      const titleField = docMeta.show_title_field_in_link
        ? docMeta.title_field
        : null;
      if (titleField && opt.value !== opt.label) {
        subtitles.push(opt.value);
      }
    }

    if (opt.description) {
      subtitles.push(opt.description);
    }

    if (opt.extra && typeof opt.extra === "string") {
      subtitles.push(opt.extra);
    }

    return subtitles;
  };

  const hasLinkField = !!linkDoctype;
  const isDisabled = disabled || !hasLinkField || metaLoading;

  const dropdown =
    isOpen && !isDisabled && hasLinkField ? (
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
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent pl-8 pr-8 py-1.5 text-sm rounded-sm outline-none placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
              placeholder={`Search ${linkDoctype}...`}
            />
            {loading && (
              <Loader2 className="absolute right-2.5 size-4 animate-spin opacity-50" />
            )}
          </div>
        </div>
        <div className="max-h-60 overflow-y-auto p-1" onScroll={handleScroll}>
          {loading && options.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Searching...
            </div>
          ) : options.length > 0 ? (
            options.map((opt, idx) => {
              const subtitles = getSubtitles(opt);
              return (
                <div
                  key={`${opt.value}-${idx}`}
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
                    value.includes(opt.value) ? "bg-accent/50" : "",
                  )}
                >
                  <div className="flex flex-col min-w-0 w-full py-0.5">
                    <span className="font-medium text-foreground truncate">
                      {opt.label}
                    </span>
                    {subtitles.length > 0 && (
                      <span className="text-xs text-muted-foreground truncate max-w-full flex items-center gap-1.5 mt-0.5">
                        {subtitles.join(" • ")}
                      </span>
                    )}
                  </div>
                  {value.includes(opt.value) && (
                    <Check className="size-4 text-primary shrink-0 ml-2" />
                  )}
                </div>
              );
            })
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
      className={cn("w-full flex flex-col gap-1.5", className)}
    >
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

      {errorMessage && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-xs text-amber-700 dark:text-amber-300">
            {errorMessage}
          </span>
        </div>
      )}

      <div className="relative">
        <div
          ref={buttonRef}
          onClick={handleOpen}
          className={cn(
            "flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors outline-none cursor-pointer",
            isDisabled && "opacity-50 cursor-not-allowed",
            isOpen && "ring-[3px] ring-ring/50 border-ring",
          )}
        >
          {metaLoading ? (
            <span className="text-muted-foreground flex items-center gap-2">
              <Loader2 className="size-3.5 animate-spin" />
              Loading...
            </span>
          ) : selectedDisplayValues.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : (
            selectedDisplayValues.map((opt) => (
              <span
                key={opt.value}
                className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs max-w-[200px]"
              >
                <span className="truncate">{opt.label}</span>
                {!isDisabled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(opt.value);
                    }}
                    className="hover:text-destructive shrink-0"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </span>
            ))
          )}
          <ChevronDown
            className={cn(
              "ml-auto size-4 opacity-50 transition-transform duration-200 shrink-0",
              isOpen && "rotate-180",
            )}
          />
        </div>
        {typeof window !== "undefined" && createPortal(dropdown, document.body)}
      </div>
    </div>
  );
};

export default TableMultiSelect;
