import type { Cake, Product, Unit } from "./types";

type Bucket = { name: string; totalBase: number; baseUnit: Unit };

const FAMILY: Record<Unit, { base: Unit; factor: number }> = {
  g: { base: "g", factor: 1 },
  kg: { base: "g", factor: 1000 },
  ml: { base: "ml", factor: 1 },
  l: { base: "ml", factor: 1000 },
  pcs: { base: "pcs", factor: 1 },
};

export function normalizeName(n: string) {
  return n.trim().toLowerCase();
}

export interface AggregatedLine {
  name: string;
  qty: number;
  unit: Unit;
  pack?: {
    count: number;          // 3
    label: string;          // "bottles"
    packSize: number;       // 2
    packUnit: Unit;         // "l"
  };
}

function roundQty(q: number) {
  return Math.round(q * 100) / 100;
}

export function aggregate(cakes: Cake[], products: Product[] = []): AggregatedLine[] {
  const productMap = new Map(products.map((p) => [p.name, p]));
  const map = new Map<string, Bucket>();

  for (const cake of cakes) {
    for (const ing of cake.ingredients) {
      const f = FAMILY[ing.unit];
      const key = `${normalizeName(ing.name)}::${f.base}`;
      const prev = map.get(key);
      const add = (Number(ing.qty) || 0) * f.factor;
      if (prev) prev.totalBase += add;
      else map.set(key, { name: ing.name.trim(), totalBase: add, baseUnit: f.base });
    }
  }

  const out: AggregatedLine[] = [];
  for (const [key, b] of map.entries()) {
    const nameKey = key.split("::")[0];
    let qty = b.totalBase;
    let unit: Unit = b.baseUnit;
    if (unit === "g" && qty >= 1000) { qty = roundQty(qty / 1000); unit = "kg"; }
    else if (unit === "ml" && qty >= 1000) { qty = roundQty(qty / 1000); unit = "l"; }
    else qty = roundQty(qty);

    let pack: AggregatedLine["pack"];
    const product = productMap.get(nameKey);
    if (product && product.packSize > 0) {
      const packFamily = FAMILY[product.packUnit];
      if (packFamily.base === b.baseUnit) {
        const packSizeInBase = product.packSize * packFamily.factor;
        const count = Math.ceil(b.totalBase / packSizeInBase);
        pack = {
          count,
          label: count === 1 ? product.packLabelSingular : product.packLabelPlural,
          packSize: product.packSize,
          packUnit: product.packUnit,
        };
      }
    }

    out.push({ name: b.name, qty, unit, pack });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export function buildShoppingMessage(listName: string, cakes: Cake[], products: Product[] = []): string {
  const lines: string[] = [];
  lines.push(`🛒 *${listName}*`);
  lines.push("");
  for (const cake of cakes) {
    if (!cake.ingredients.length) continue;
    lines.push(`🎂 _${cake.name}_`);
    for (const i of cake.ingredients) {
      lines.push(`  • ${i.name} — ${i.qty} ${i.unit}`);
    }
    lines.push("");
  }
  lines.push("✨ *Total to buy:*");
  for (const line of aggregate(cakes, products)) {
    if (line.pack) {
      lines.push(`  ✔️ ${line.name} — ${line.qty} ${line.unit}  →  *${line.pack.count} ${line.pack.label}* (${line.pack.packSize} ${line.pack.packUnit} each)`);
    } else {
      lines.push(`  ✔️ ${line.name} — ${line.qty} ${line.unit}`);
    }
  }
  return lines.join("\n");
}
