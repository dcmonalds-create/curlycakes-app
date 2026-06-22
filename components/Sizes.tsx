"use client";
import { useMemo, useState } from "react";
import { useLocalState, uid } from "@/lib/storage";
import type { CakeSize } from "@/lib/types";
import { DEFAULT_SIZE_TABLE, findSizeForPeople, sortByDiameter } from "@/lib/sizes";

export function Sizes() {
  const [table, setTable, hydrated] = useLocalState<CakeSize[]>("cc:sizes", DEFAULT_SIZE_TABLE);
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

      <button onClick={() => setEditing(true)} className="btn-ghost w-full">
        Edit size table ({table.length} entries)
      </button>
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
  function resetDefaults() {
    if (confirm("Replace the table with the Street Kitchen defaults (18 cm = base)?")) onChange(DEFAULT_SIZE_TABLE);
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
              <input
                className="input w-20 text-right"
                type="text"
                inputMode="decimal"
                pattern="[0-9.,]*"
                value={r.multiplier || ""}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(",", ".").replace(/[^0-9.]/g, "");
                  update(r.id, { multiplier: Number(cleaned) || 0 });
                }}
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
