import type { CakeSize, Ingredient } from "./types";

/** Default table — Street Kitchen "Tortaforma-kisokos" (18 cm = base 1×). */
export const DEFAULT_SIZE_TABLE: CakeSize[] = [
  { id: "s16", diameter: 16, people: 8,  multiplier: 0.8 },
  { id: "s18", diameter: 18, people: 11, multiplier: 1.0 },
  { id: "s20", diameter: 20, people: 13, multiplier: 1.2 },
  { id: "s22", diameter: 22, people: 16, multiplier: 1.5 },
  { id: "s24", diameter: 24, people: 19, multiplier: 1.8 },
  { id: "s26", diameter: 26, people: 22, multiplier: 2.0 },
  { id: "s28", diameter: 28, people: 28, multiplier: 2.4 },
  { id: "s30", diameter: 30, people: 32, multiplier: 2.8 },
];

export const BASE_DIAMETER = 18;

/** Sort ascending by diameter. */
export function sortByDiameter(table: CakeSize[]): CakeSize[] {
  return [...table].sort((a, b) => a.diameter - b.diameter);
}

/** Find the smallest cake whose capacity is ≥ people. Falls back to the largest. */
export function findSizeForPeople(table: CakeSize[], people: number): CakeSize | null {
  if (!table.length || people <= 0) return null;
  const sorted = [...table].sort((a, b) => a.people - b.people);
  for (const row of sorted) if (row.people >= people) return row;
  return sorted[sorted.length - 1];
}

/** Find table entry for an exact diameter (or null if not in the table). */
export function findSizeByDiameter(table: CakeSize[], diameter: number): CakeSize | null {
  return table.find((r) => r.diameter === diameter) ?? null;
}

/** Multiplier for a given diameter. If missing from the table, falls back to area ratio (d/18)². */
export function multiplierFor(table: CakeSize[], diameter: number): number {
  const row = findSizeByDiameter(table, diameter);
  if (row && row.multiplier > 0) return row.multiplier;
  if (diameter > 0) return Math.round((diameter / BASE_DIAMETER) ** 2 * 100) / 100;
  return 1;
}

/** Scale ingredients from one diameter to another using the table's multiplier ratio. */
export function scaleByDiameter(
  ingredients: Ingredient[],
  table: CakeSize[],
  baseDiameter: number,
  targetDiameter: number,
): Ingredient[] {
  const baseMult = multiplierFor(table, baseDiameter);
  const targetMult = multiplierFor(table, targetDiameter);
  const factor = baseMult > 0 ? targetMult / baseMult : 1;
  return ingredients.map((i) => ({
    ...i,
    qty: Math.round(i.qty * factor * 100) / 100,
  }));
}
