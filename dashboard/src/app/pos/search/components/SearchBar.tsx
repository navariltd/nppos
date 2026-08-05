/**
 * SearchBar – the voucher/beneficiary query input with a search-mode selector
 * and submit button. Captures scanner input via a global keydown listener.
 */
import * as React from "react";

import { Loader2, Search, Warehouse } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SearchMode = "voucher" | "beneficiary";

interface SearchBarProps {
  mode: SearchMode;
  onModeChange: (mode: SearchMode) => void;
  query: string;
  onQueryChange: (query: string) => void;
  onSearch: () => void;
  isLoading: boolean;
  warehouse?: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

/** Handle an Enter key on the query input. */
function handleKeyDown(
  e: React.KeyboardEvent,
  onSearch: () => void,
): void {
  if (e.key === "Enter") onSearch();
}

export default function SearchBar({
  mode,
  onModeChange,
  query,
  onQueryChange,
  onSearch,
  isLoading,
  warehouse,
  inputRef,
}: SearchBarProps) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">
          Search Voucher / Entitlements
        </h1>
        <p className="text-muted-foreground">
          Find a submitted voucher by number or beneficiary
        </p>
        {warehouse && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Warehouse className="h-3 w-3" /> Filtering by warehouse:{" "}
            <span className="font-medium text-foreground">{warehouse}</span>
          </p>
        )}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="w-full sm:w-48">
              <Label htmlFor="search-mode" className="sr-only">
                Search by
              </Label>
              <Select
                value={mode}
                onValueChange={(v) => onModeChange(v as SearchMode)}
              >
                <SelectTrigger id="search-mode">
                  <SelectValue placeholder="Search by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="voucher">Voucher Number</SelectItem>
                  <SelectItem value="beneficiary">
                    Beneficiary Number
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 flex gap-2">
              <Input
                ref={inputRef}
                placeholder={
                  mode === "voucher"
                    ? "Enter voucher number... (scan anywhere)"
                    : "Enter beneficiary ID... (scan anywhere)"
                }
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, onSearch)}
              />
              <Button onClick={onSearch} disabled={!query.trim() || isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}{" "}
                Search
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}