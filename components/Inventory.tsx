"use client";
import { useMemo, useState } from "react";
import { useLocalState, uid } from "@/lib/storage";
import { UNITS, type InventoryItem, type Unit } from "@/lib/types";
import { addToInventory } from "@/lib/inventory";
import { QtyInput } from "@/components/QtyInput";
import { parseQty } from "@/lib/qty";
import { tgConfirm } from "@/lib/telegram";

export function Inventory() {
  const [inv, setInv] = useLocalState<InventoryItem[]>("cc:inventory", []);
  const [draft, setDraft] = useState<{ name: string; qty: string; unit: Unit }>({ name: "", qty: "", unit: "g" });
  const [query, setQuery] = useState("");

  const sorted = useMemo(() => {
    const filtered = query.trim()
      ? inv.filter((i) => i.name.toLowerCase().includes(query.trim().toLowerCase()))
      : inv;
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }, [inv, query]);

  function addPurchase() {
    const name = draft.name.trim();
    const qty = parseQty(draft.qty);
    if (!name || !qty || qty <= 0) return;
    setInv(addToInventory(inv, name, qty, draft.unit));
    setDraft({ name: "", qty: "", unit: draft.unit });
  }

  function updateItem(id: string, patch: Partial<InventoryItem>) {
    setInv(inv.map((i) => (i.id === id ? { ...i, ...patch, updatedAt: Date.now() } : i)));
  }
  function removeItem(id: string) {
    setInv(inv.filter((i) => i.id !== id));
  }
  async function clearAll() {
    if (!inv.length) return;
    if (!await tgConfirm("Clear the entire pantry?")) return;
    setInv([]);
  }

  return (
    <div className="px-5 space-y-5">
      <div className="card space-y-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-subtle">+ New purchase</p>
          <h3 className="font-display text-xl text-ink mt-0.5">Add to pantry</h3>
        </div>
        <input
          className="input"
          placeholder="Ingredient (e.g. Flour)"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
        <div className="flex gap-2 items-center">
          <input
            className="input flex-1 text-right"
            placeholder="Qty"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            pattern="[0-9.,]*"
            value={draft.qty}
            onChange={(e) => setDraft({ ...draft, qty: e.target.value })}
          />
          <select className="input flex-1" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value as Unit })}>
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          <button onClick={addPurchase} className="btn-primary !px-4 !py-2 shrink-0">+ Add</button>
        </div>
      </div>

      <div className="card space-y-3">
        <div className="flex justify-between items-baseline">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-subtle">Pantry</p>
            <h3 className="font-display text-xl text-ink mt-0.5">In stock</h3>
          </div>
          <span className="chip">{inv.length} item{inv.length !== 1 ? "s" : ""}</span>
        </div>

        <input
          className="input"
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {sorted.length === 0 ? (
          <p className="text-sm text-muted text-center py-6 font-display italic text-xl">
            {inv.length === 0 ? "Pantry is empty." : "No matches."}
          </p>
        ) : (
          <ul className="space-y-2">
            {sorted.map((i) => (
              <li key={i.id} className="space-y-1.5 pb-2 border-b border-line last:border-0">
                <input
                  className="input"
                  value={i.name}
                  onChange={(e) => updateItem(i.id, { name: e.target.value })}
                />
                <div className="flex gap-2 items-center">
                  <QtyInput
                    className="input flex-1 text-right"
                    value={i.qty}
                    onChange={(n) => updateItem(i.id, { qty: n })}
                  />
                  <select
                    className="input flex-1"
                    value={i.unit}
                    onChange={(e) => updateItem(i.id, { unit: e.target.value as Unit })}
                  >
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <button onClick={() => removeItem(i.id)} className="shrink-0 text-subtle px-1 text-lg">×</button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {inv.length > 0 && (
          <button onClick={clearAll} className="text-[11px] text-muted underline w-full text-left">
            Clear pantry
          </button>
        )}
      </div>
    </div>
  );
}
