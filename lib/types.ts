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
}

export interface Product {
  name: string;          // lowercased key, e.g. "milk"
  displayName: string;   // "Milk"
  packSize: number;      // 2
  packUnit: Unit;        // "l"
  packLabelSingular: string; // "bottle"
  packLabelPlural: string;   // "bottles"
}

export interface Recipe {
  id: string;
  title: string;
  category: string;
  body: string;
  ingredients?: Ingredient[]; // quantities for 1 portion
  updatedAt: number;
}
