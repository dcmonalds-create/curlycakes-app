/** Parse a user-typed quantity that may use comma or dot as separator.
 *  Returns 0 for empty / invalid input. */
export function parseQty(s: string): number {
  if (!s) return 0;
  // Replace first comma with dot, strip everything else but digits and dot.
  const cleaned = s.replace(",", ".").replace(/[^0-9.]/g, "");
  if (cleaned === "" || cleaned === ".") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** Format a stored quantity for display, using the browser's locale.
 *  Hungarian / Romanian / etc. will see comma; English will see dot. */
export function formatQty(n: number): string {
  if (!n) return "";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(n);
}
