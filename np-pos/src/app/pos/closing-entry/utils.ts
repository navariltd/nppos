/** Utility functions for POS Closing Entry formatting and date conversion. */

const CURRENCY = "KES";

/** Format a number as KES currency string. */
export function fmt(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: CURRENCY,
    minimumFractionDigits: 2,
  }).format(amount);
}

/** Format a date string to a human-readable format (e.g. "Jan 15, 2024, 02:30 PM"). */
export function fmtDate(d: string): string {
  if (!d) return "-";
  try {
    return new Date(d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d;
  }
}

/** Return today's date in YYYY-MM-DD format. */
export function nowDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Return current time in HH:mm:ss (24-hour) format. */
export function nowTime(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

/**
 * Return the current datetime in "YYYY-MM-DD HH:mm:ss" format.
 * This matches the format expected by ERPNext whitelisted methods.
 */
export function nowDatetime(): string {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * Convert any date/datetime string to "YYYY-MM-DD HH:mm:ss" format.
 *
 * Handles ISO strings, plain dates, and already-formatted datetimes.
 * Falls back to stripping T/Z separators if parsing fails.
 */
export function toERPNextDatetime(val: string): string {
  if (!val) return "";

  const d = new Date(val);
  if (isNaN(d.getTime())) {
    return val.replace("T", " ").replace("Z", "").split(".")[0];
  }

  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}