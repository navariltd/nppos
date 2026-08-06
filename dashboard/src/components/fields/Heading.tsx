"use client";

import { cn } from "@/lib/utils";

interface HeadingProps {
  value?: any;
  onChange?: (val: any) => void;
  onBlur?: () => void;
  className?: string;
  disabled?: boolean;
  label?: string;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
}

export const Heading = ({
  value,
  onChange,
  onBlur,
  className = "",
  disabled = false,
  label = "Heading",
  level = 2,
}: HeadingProps) => {
  const Tag = `h${level}` as keyof React.HTMLAttributes<HTMLElement>;

  const sizeClasses = {
    1: "text-4xl font-bold",
    2: "text-3xl font-semibold",
    3: "text-2xl font-semibold",
    4: "text-xl font-medium",
    5: "text-lg font-medium",
    6: "text-base font-medium",
  };

  return (
    <div className={cn("w-full", className)} onBlur={onBlur}>
      <Tag className={cn(sizeClasses[level], "text-foreground")}>{label}</Tag>
    </div>
  );
};
