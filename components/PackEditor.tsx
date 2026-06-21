"use client";
import { useState } from "react";
import { UNITS, type Unit, type Product } from "@/lib/types";
import { normalizeName } from "@/lib/aggregate";

const PRESETS: { singular: string; plural: string; icon: string }[] = [
  { singular: "bottle", plural: "bottles", icon: "🍶" },
  { singular: "pack",   plural: "packs",   icon: "📦" },
  { singular: "tray",   plural: "trays",   icon: "🥚" },
  { singular: "bar",    plural: "bars",    icon: "🍫" },
  { singular: "box",    plural: "boxes",   icon: "🎁" },
  { singular: "bag",    plural: "bags",    icon: "🛍️" },
  { singular: "can",    plural: "cans",    icon: "🥫" },
];

function defaultLabelFor(unit: Unit): { singular: string; plural: string } {
  if (unit === "l" || unit === "ml") return { singular: "bottle", plural: "bottles" };
  if (unit === "pcs") return { singular: "tray", plural: "trays" };
  return { singular: "pack", plural: "packs" };
}

export function PackEditor({
  ingredientName,
  existing,
  defaultUnit,
  onSave,
  onClear,
  onCancel,
}: {
  ingredientName: string;
  existing?: Product;
  defaultUnit: Unit;
  onSave: (p: Product) => void;
  onClear?: () => void;
  onCancel: () => void;
}) {
  const initUnit = existing?.packUnit ?? defaultUnit;
  const initLabels = existing
    ? { singular: existing.packLabelSingular, plural: existing.packLabelPlural }
    : defaultLabelFor(initUnit);

  const [size, setSize] = useState<string>(existing?.packSize?.toString() ?? "");
  const [unit, setUnit] = useState<Unit>(initUnit);
  const [singular, setSingular] = useState<string>(initLabels.singular);
  const [plural, setPlural] = useState<string>(initLabels.plural);
  const [showPlural, setShowPlural] = useState<boolean>(false);

  function pickPreset(p: { singular: string; plural: string }) {
    setSingular(p.singular);
    setPlural(p.plural);
  }

  function changeUnit(u: Unit) {
    setUnit(u);
    const matchedPreset = PRESETS.find((p) => p.singular === singular && p.plural === plural);
    if (matchedPreset || (!existing && !showPlural)) {
      const d = defaultLabelFor(u);
      setSingular(d.singular);
      setPlural(d.plural);
    }
  }

  function save() {
    const n = Number(size);
    const s = singular.trim();
    if (!n || n <= 0 || !s) return;
    const pl = plural.trim() || s;
    onSave({
      name: normalizeName(ingredientName),
      displayName: ingredientName.trim(),
      packSize: n,
      packUnit: unit,
      packLabelSingular: s,
      packLabelPlural: pl,
    });
  }

  return (
    <div className="bg-surface-2 rounded-2xl p-3 space-y-3 border border-line">
      <p className="text-xs text-ink font-semibold">📦 Package for "{ingredientName}"</p>

      <div className="flex gap-2 items-center">
        <input
          className="input w-20 text-right"
          placeholder="Size"
          type="number"
          inputMode="decimal"
          value={size}
          onChange={(e) => setSize(e.target.value)}
        />
        <select className="input w-20" value={unit} onChange={(e) => changeUnit(e.target.value as Unit)}>
          {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <span className="text-xs text-muted shrink-0">per</span>
        <input
          className="input flex-1"
          placeholder="pack"
          value={singular}
          onChange={(e) => setSingular(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-1">
        {PRESETS.map((p) => (
          <button
            key={p.singular}
            type="button"
            onClick={() => pickPreset(p)}
            className={`text-xs px-2 py-1 rounded-full border transition ${
              singular === p.singular && plural === p.plural
                ? "bg-accent text-bg border-accent"
                : "bg-surface text-muted border-line"
            }`}
          >
            {p.icon} {p.singular}
          </button>
        ))}
      </div>

      {!showPlural ? (
        <button type="button" onClick={() => setShowPlural(true)} className="text-[11px] text-muted underline">
          Edit plural form ("{plural}")
        </button>
      ) : (
        <input
          className="input"
          placeholder="Plural (e.g. bottles)"
          value={plural}
          onChange={(e) => setPlural(e.target.value)}
        />
      )}

      <p className="text-[11px] text-muted">e.g. Milk = 2 L per bottle  •  Eggs = 10 pcs per tray  •  Sugar = 1 kg per pack</p>

      <div className="flex gap-2">
        <button onClick={save} className="btn-primary flex-1 text-sm">Save</button>
        {onClear && <button onClick={onClear} className="btn-ghost text-sm">Remove</button>}
        <button onClick={onCancel} className="btn-ghost text-sm">Cancel</button>
      </div>
    </div>
  );
}
