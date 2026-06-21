"use client";
import { useState } from "react";
import { parseQty, formatQty } from "@/lib/qty";

/** Decimal-friendly numeric input that accepts comma OR dot.
 *  Internally stores a `draft` string while the field is focused so the user
 *  can freely type "1," then "5"; on blur the value re-formats to the locale. */
export function QtyInput({
  value,
  onChange,
  className,
  placeholder,
}: {
  value: number;
  onChange: (n: number) => void;
  className?: string;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const display = draft ?? formatQty(value);
  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      pattern="[0-9.,]*"
      className={className}
      placeholder={placeholder}
      value={display}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        onChange(parseQty(raw));
      }}
      onBlur={() => setDraft(null)}
    />
  );
}
