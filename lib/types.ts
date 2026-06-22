export type Unit = "g" | "kg" | "ml" | "l" | "pcs";

export const UNITS: Unit[] = ["g", "kg", "ml", "l", "pcs"];

export interface Ingredient {
  id: string;
  name: string;
  qty: number;
  unit: Unit;
}

export interface Cake {
  id: string;
  name: string;
  ingredients: Ingredient[];
}

export interface ShoppingList {
  id: string;
  name: string;
  createdAt: number;
  cakes: Cake[];
  /** Normalized ingredient names that have been checked off in the totals view. */
  checked?: string[];
}

export interface CakeSize {
  id: string;
  diameter: number;     // cm — the tin diameter
  people: number;       // max servings ("slices") for this size — used for the people-lookup
  multiplier: number;   // scaling factor relative to the base 18cm (e.g. 22cm = 1.5)
}

export interface Product {
  name: string;          // lowercased key, e.g. "milk"
  displayName: string;   // "Milk"
  packSize: number;      // 2
  packUnit: Unit;        // "l"
  packLabelSingular: string; // "bottle"
  packLabelPlural: string;   // "bottles"
}

export type RecipeKind = "cake" | "other";

export interface Recipe {
  id: string;
  title: string;
  category: string;
  body: string;
  ingredients?: Ingredient[];     // quantities for the base portion / diameter
  kind?: RecipeKind;              // "cake" → scales by diameter, "other" → scales by portions
  baseDiameter?: number;          // cm — only meaningful when kind = "cake" (default 18)
  basePortions?: number;          // only meaningful when kind = "other" (default 1)
  updatedAt: number;
}
