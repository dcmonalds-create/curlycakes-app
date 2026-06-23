"use client";
import { useMemo, useState } from "react";
import { useLocalState, uid } from "@/lib/storage";
import type { CakeSize, Recipe, ShoppingList, Ingredient } from "@/lib/types";
import { DEFAULT_SIZE_TABLE, findSizeForPeople, sortByDiameter, scaleByDiameter, BASE_DIAMETER } from "@/lib/sizes";
import { QtyInput } from "@/components/QtyInput";
import { tgConfirm, tgAlert } from "@/lib/telegram";

export function Sizes() {
  const [table, setTable, hydrated] = useLocalState<CakeSize[]>("cc:sizes", DEFAULT_SIZE_TABLE);
  const [recipes] = useLocalState<Recipe[]>("cc:recipes", []);
  const [lists, setLists] = useLocalState<ShoppingList[]>("cc:lists", []);
  const [people, setPeople] = useState<string>("");
  const [editing, setEditing] = useState<boolean>(false);

  const peopleNum = Number(people) || 0;
  const match = useMemo(() => findSizeForPeople(table, peopleNum), [table, peopleNum]);
  const exceedsLargest = useMemo(() => {
    if (!table.length) return false;
    const max = Math.max(...table.map((r) => r.people));
    return peopleNum > max;
  }, [table, peopleNum]);

  if (editing) {
    return <SizeTable table={table} hydrated={hydrated} onChange={setTable} onDone={() => setEditing(false)} />;
  }

  return (
    <div className="px-5 space-y-5">
      <div className="card space-y-3">
        <label className="block">
          <p className="text-[10px] uppercase tracking-[0.2em] text-subtle mb-2">How many people?</p>
          <input
            className="input font-display text-4xl text-ink text-center py-5"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            pattern="[0-9]*"
            placeholder="—"
            value={people}
            onChange={(e) => setPeople(e.target.value.replace(/[^0-9]/g, ""))}
          />
        </label>
      </div>

      <div className="card relative overflow-hidden min-h-[280px] grid place-items-center">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-accent/10 blur-2xl pointer-events-none" />
        {peopleNum > 0 && match ? (
          <ResultDisplay people={peopleNum} match={match} exceedsLargest={exceedsLargest} />
        ) : (
          <div className="text-center text-muted">
            <p className="font-display italic text-2xl mb-1">Tell me how many.</p>
            <p className="text-sm text-subtle">I'll tell you the size.</p>
          </div>
        )}
      </div>

      {peopleNum > 0 && match && recipes.length > 0 && (
        <BuildList
          target={match}
          recipes={recipes}
          sizes={table}
          lists={lists}
          onSave={setLists}
        />
      )}

      <button onClick={() => setEditing(true)} className="btn-ghost w-full">
        Edit size table ({table.length} entries)
      </button>
    </div>
  );
}

function BuildList({
  target,
  recipes,
  sizes,
  lists,
  onSave,
}: {
  target: CakeSize;
  recipes: Recipe[];
  sizes: CakeSize[];
  lists: ShoppingList[];
  onSave: (next: ShoppingList[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [listId, setListId] = useState<string>(lists[0]?.id ?? "__new__");
  const [newListName, setNewListName] = useState<string>("");

  // Only cake-kind recipes can be scaled by diameter. "Other" recipes go in unchanged at base portions.
  const cakeRecipes = useMemo(() => recipes.filter((r) => (r.kind ?? "cake") === "cake" && (r.ingredients?.length ?? 0) > 0), [recipes]);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  }

  function addAll() {
    const picked = recipes.filter((r) => selected.has(r.id));
    if (picked.length === 0) return;
    const cakes = picked.map((r) => {
      const baseD = r.baseDiameter ?? BASE_DIAMETER;
      const scaled: Ingredient[] = scaleByDiameter(r.ingredients ?? [], sizes, baseD, target.diameter).map((i) => ({
        id: uid(), name: i.name, qty: i.qty, unit: i.unit,
      }));
      return { id: uid(), name: `${r.title} (${target.diameter} cm)`, ingredients: scaled };
    });
    if (listId === "__new__") {
      const name = (newListName.trim()) || `${target.diameter} cm cake`;
      const newList: ShoppingList = { id: uid(), name, createdAt: Date.now(), cakes };
      onSave([newList, ...lists]);
    } else {
      onSave(lists.map((l) => (l.id === listId ? { ...l, cakes: [...l.cakes, ...cakes] } : l)));
    }
    setSelected(new Set());
    tgAlert(`✨ Added ${cakes.length} recipe${cakes.length !== 1 ? "s" : ""} scaled to ${target.diameter} cm.`);
  }

  return (
    <div className="card space-y-3">
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-subtle">Build a list</p>
        <h3 className="font-display text-xl text-ink mt-0.5">Recipes for this {target.diameter} cm cake</h3>
        <p className="text-[11px] text-muted mt-1">
          Each recipe will be auto-scaled from its base diameter to {target.diameter} cm (×{target.multiplier}).
        </p>
      </div>

      {cakeRecipes.length === 0 ? (
        <p className="text-sm text-muted text-center py-3">No "cake" recipes with ingredients yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {cakeRecipes.map((r) => {
            const checked = selected.has(r.id);
            return (
              <li key={r.id}>
                <button
                  onClick={() => toggle(r.id)}
                  className="w-full flex items-center gap-3 text-left p-2 -mx-2 rounded-lg active:bg-surface-2 transition"
                >
                  <span className={`grid place-items-center shrink-0 w-5 h-5 rounded-full border-2 transition
                    ${checked ? "bg-ink border-ink text-bg" : "border-line"}`}>
                    {checked && <span className="text-[11px] leading-none">✓</span>}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink truncate">{r.title}</p>
                    <p className="text-[11px] text-muted">{r.category} · base {r.baseDiameter ?? BASE_DIAMETER} cm</p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {selected.size > 0 && (
        <>
          <div>
            <label className="text-[10px] uppercase tracking-[0.2em] text-subtle">Add to list</label>
            <select className="input mt-2" value={listId} onChange={(e) => setListId(e.target.value)}>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>{l.name} ({l.cakes.length})</option>
              ))}
              <option value="__new__">＋ New list…</option>
            </select>
            {listId === "__new__" && (
              <input
                className="input mt-2"
                placeholder={`List name (e.g. "Saturday order")`}
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
              />
            )}
          </div>

          <button onClick={addAll} className="btn-primary w-full">
            Add {selected.size} recipe{selected.size !== 1 ? "s" : ""} to list
          </button>
        </>
      )}
    </div>
  );
}

function ResultDisplay({ people, match, exceedsLargest }: { people: number; match: CakeSize; exceedsLargest: boolean }) {
  const px = Math.round(110 + ((Math.min(match.diameter, 32) - 10) / 22) * 110);
  return (
    <div className="text-center space-y-4 py-3">
      <p className="text-[10px] uppercase tracking-[0.25em] text-subtle">For {people} {people === 1 ? "person" : "people"}</p>
      <div
        className="mx-auto rounded-full border-2 border-ink grid place-items-center relative bg-surface-2"
        style={{ width: px, height: px }}
      >
        <div className="absolute inset-3 rounded-full border border-line" />
        <div className="text-center">
          <p className="font-display text-5xl text-ink leading-none">{match.diameter}</p>
          <p className="text-xs text-muted tracking-wide mt-1">cm diameter</p>
        </div>
      </div>
      <div className="flex justify-center gap-4 text-xs text-muted">
        <span>Serves up to <span className="font-semibold text-ink">{match.people}</span></span>
        <span className="text-subtle">·</span>
        <span>×<span className="font-semibold text-ink">{match.multiplier}</span> base</span>
      </div>
      {exceedsLargest && <p className="text-warn text-[11px]">⚠ exceeds your table — using largest</p>}
    </div>
  );
}

function SizeTable({
  table,
  hydrated,
  onChange,
  onDone,
}: {
  table: CakeSize[];
  hydrated: boolean;
  onChange: (next: CakeSize[]) => void;
  onDone: () => void;
}) {
  const sorted = useMemo(() => sortByDiameter(table), [table]);

  function update(id: string, patch: Partial<CakeSize>) {
    onChange(table.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function remove(id: string) { onChange(table.filter((r) => r.id !== id)); }
  function add()    { onChange([...table, { id: uid(), diameter: 0, people: 0, multiplier: 1 }]); }
  async function resetDefaults() {
    if (await tgConfirm("Replace the table with the Street Kitchen defaults (18 cm = base)?")) onChange(DEFAULT_SIZE_TABLE);
  }

  return (
    <div className="px-5 space-y-4">
      <div className="flex justify-between items-center">
        <button onClick={onDone} className="btn-ghost text-sm">← Back</button>
        <button onClick={resetDefaults} className="text-xs text-muted underline">Reset defaults</button>
      </div>

      <div className="card space-y-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-subtle">Your sizes</p>
          <h2 className="font-display text-2xl text-ink mt-0.5">Tin chart</h2>
          <p className="text-xs text-muted mt-1">
            The <b>multiplier</b> scales ingredients written for the base 18 cm cake.
            If you write a recipe for 18 cm needing 100 g flour, a 22 cm version needs 100 × 1.5 = 150 g.
          </p>
        </div>

        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-subtle px-1">
          <span className="flex-1">Diameter cm</span>
          <span className="w-20 text-right">Slices</span>
          <span className="w-20 text-right">×</span>
          <span className="w-6" />
        </div>

        <ul className="space-y-2">
          {sorted.map((r) => (
            <li key={r.id} className="flex items-center gap-2">
              <input
                className="input flex-1 text-right"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={r.diameter || ""}
                onChange={(e) => update(r.id, { diameter: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })}
              />
              <input
                className="input w-20 text-right"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={r.people || ""}
                onChange={(e) => update(r.id, { people: Number(e.target.value.replace(/[^0-9]/g, "")) || 0 })}
              />
              <QtyInput
                className="input w-20 text-right"
                value={r.multiplier}
                onChange={(n) => update(r.id, { multiplier: n })}
              />
              <button onClick={() => remove(r.id)} className="w-6 text-subtle text-lg leading-none">×</button>
            </li>
          ))}
        </ul>

        <button onClick={add} className="btn-ghost w-full text-sm">+ Add a size</button>
      </div>

      {hydrated && table.length === 0 && (
        <p className="text-xs text-muted text-center">Your table is empty — add at least one row, or reset to defaults.</p>
      )}
    </div>
  );
}
