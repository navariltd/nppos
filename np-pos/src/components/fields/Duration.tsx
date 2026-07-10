"use client";

import { cn } from "@/lib/utils";
import * as React from "react";

interface DurationProps {
  value: number;
  onChange: (val: number) => void;
  onBlur?: () => void;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  label?: string;
}

export const Duration = ({
  value = 0,
  onChange,
  onBlur,
  className = "",
  disabled = false,
  required = false,
  label,
}: DurationProps) => {
  const [hours, setHours] = React.useState(Math.floor(value / 3600));
  const [minutes, setMinutes] = React.useState(Math.floor((value % 3600) / 60));
  const [seconds, setSeconds] = React.useState(Math.floor(value % 60));

  const updateValue = (h: number, m: number, s: number) => {
    const total = h * 3600 + m * 60 + s;
    onChange(total);
  };

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const h = parseInt(e.target.value) || 0;
    setHours(h);
    updateValue(h, minutes, seconds);
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const m = parseInt(e.target.value) || 0;
    setMinutes(m);
    updateValue(hours, m, seconds);
  };

  const handleSecondChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const s = parseInt(e.target.value) || 0;
    setSeconds(s);
    updateValue(hours, minutes, s);
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
      <div className="flex gap-2">
        <div className="flex-1">
          <input
            type="number"
            value={hours}
            onChange={handleHourChange}
            onBlur={onBlur}
            disabled={disabled}
            min={0}
            className={cn(
              "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              className,
            )}
          />
          <span className="text-xs text-muted-foreground mt-1 block">
            Hours
          </span>
        </div>
        <div className="flex-1">
          <input
            type="number"
            value={minutes}
            onChange={handleMinuteChange}
            onBlur={onBlur}
            disabled={disabled}
            min={0}
            max={59}
            className={cn(
              "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              className,
            )}
          />
          <span className="text-xs text-muted-foreground mt-1 block">
            Minutes
          </span>
        </div>
        <div className="flex-1">
          <input
            type="number"
            value={seconds}
            onChange={handleSecondChange}
            onBlur={onBlur}
            disabled={disabled}
            min={0}
            max={59}
            className={cn(
              "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
              className,
            )}
          />
          <span className="text-xs text-muted-foreground mt-1 block">
            Seconds
          </span>
        </div>
      </div>
    </div>
  );
};
