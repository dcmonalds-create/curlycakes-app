import type { InventoryItem, Unit } from "./types";
import { uid } from "./storage";
import { normalizeName } from "./aggregate";

const FAMILY: Record<Unit, { base: Unit; factor: number }> = {
  g:  { base: "g",  factor: 1 },
  kg: { base: "g",  factor: 1000 },
  ml: { base: "ml", factor: 1 },
  l:  { base: "ml", factor: 1000 },
  pcs:{ base: "pcs",factor: 1 },
};

function sameFamily(a: Unit, b: Unit) {
  return FAMILY[a].base === FAMILY[b].base;
}

/** Convert qty from one unit to another within the same family. */
function convert(qty: number, from: Unit, to: Unit): number {
  if (from === to) return qty;
  if (!sameFamily(from, to)) return qty;
  const base = qty * FAMILY[from].factor;
  return base / FAMILY[to].factor;
}

function pickBestUnit(qtyInBase: number, baseUnit: Unit): Unit {
  if (baseUnit === "g"  && qtyInBase >= 1000) return "kg";
  if (baseUnit === "ml" && qtyInBase >= 1000) return "l";
  return baseUnit;
}

/** Add qty to stock. If an item with the same normalized name + matching unit family
 *  exists, merge into it (keeping the larger of the two units). Otherwise create new. */
export function addToInventory(
  inv: InventoryItem[],
  name: string,
  qty: number,
  unit: Unit,
): InventoryItem[] {
  const key = normalizeName(name);
  const existingIdx = inv.findIndex((i) => normalizeName(i.name) === key && sameFamily(i.unit, unit));
  if (existingIdx === -1) {
    return [
      ...inv,
      { id: uid(), name: name.trim(), qty: round(qty), unit, updatedAt: Date.now() },
    ];
  }
  const existing = inv[existingIdx];
  // Normalize both to existing's base unit, sum, then pick best display unit.
  const baseUnit = FAMILY[existing.unit].base;
  const total = convert(existing.qty, existing.unit, baseUnit) + convert(qty, unit, baseUnit);
  const displayUnit = pickBestUnit(total, baseUnit);
  return inv.map((i, idx) => idx === existingIdx
    ? { ...i, qty: round(convert(total, baseUnit, displayUnit)), unit: displayUnit, updatedAt: Date.now() }
    : i
  );
}

/** Subtract qty from stock; if not enough or item missing, the result clamps to 0
 *  and we return both new inventory and a list of {name, missing} for the caller to surface. */
export interface DeductReport {
  inventory: InventoryItem[];
  shortages: { name: string; missing: number; unit: Unit }[];
}

export function deductFromInventory(
  inv: InventoryItem[],
  lines: { name: string; qty: number; unit: Unit }[],
): DeductReport {
  let next = [...inv];
  const shortages: DeductReport["shortages"] = [];

  for (const line of lines) {
    const key = normalizeName(line.name);
    const idx = next.findIndex((i) => normalizeName(i.name) === key && sameFamily(i.unit, line.unit));
    if (idx === -1) {
      shortages.push({ name: line.name, missing: line.qty, unit: line.unit });
      continue;
    }
    const existing = next[idx];
    const baseUnit = FAMILY[existing.unit].base;
    const have = convert(existing.qty, existing.unit, baseUnit);
    const want = convert(line.qty, line.unit, baseUnit);
    const remain = have - want;
    if (remain < 0) {
      shortages.push({
        name: existing.name,
        missing: round(convert(-remain, baseUnit, line.unit)),
        unit: line.unit,
      });
      next = next.filter((_, i) => i !== idx);
    } else if (remain === 0) {
      next = next.filter((_, i) => i !== idx);
    } else {
      const displayUnit = pickBestUnit(remain, baseUnit);
      next = next.map((i, j) => j === idx
        ? { ...i, qty: round(convert(remain, baseUnit, displayUnit)), unit: displayUnit, updatedAt: Date.now() }
        : i,
      );
    }
  }
  return { inventory: next, shortages };
}

function round(n: number) { return Math.round(n * 100) / 100; }
