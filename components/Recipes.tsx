"use client";
import { useMemo, useState } from "react";
import { useLocalState, uid } from "@/lib/storage";
import type { Recipe } from "@/lib/types";

const DEFAULT_CATEGORIES = ["Sponge", "Cream", "Frosting", "Decoration", "Dough", "Other"];

export function Recipes() {
  const [recipes, setRecipes] = useLocalState<Recipe[]>("cc:recipes", []);
  const [filter, setFilter] = useState<string>("All");
  const [openId, setOpenId] = useState<string | null>(null);

  const categories = useMemo(() => {
    const fromRecipes = recipes.map((r) => r.category).filter(Boolean);
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...fromRecipes]));
  }, [recipes]);

  const visible = filter === "All" ? recipes : recipes.filter((r) => r.category === filter);
  const open = recipes.find((r) => r.id === openId) || null;

  function addRecipe() {
    const title = prompt("Recipe title")?.trim();
    if (!title) return;
    const category = prompt(`Category? (e.g. ${DEFAULT_CATEGORIES.join(", ")})`)?.trim() || "Other";
    const r: Recipe = { id: uid(), title, category, body: "", updatedAt: Date.now() };
    setRecipes([r, ...recipes]);
    setOpenId(r.id);
  }

  function update(updated: Recipe) {
    setRecipes(recipes.map((r) => (r.id === updated.id ? { ...updated, updatedAt: Date.now() } : r)));
  }

  function remove(id: string) {
    if (!confirm("Delete this recipe?")) return;
    setRecipes(recipes.filter((r) => r.id !== id));
    if (openId === id) setOpenId(null);
  }

  if (open) {
    return (
      <div className="px-5 space-y-3">
        <div className="flex justify-between">
          <button onClick={() => setOpenId(null)} className="btn-ghost text-sm">← Back</button>
          <button onClick={() => remove(open.id)} className="text-xs text-rose-400">Delete</button>
        </div>
        <div className="card space-y-3">
          <input
            className="input font-display text-xl text-rose-700"
            value={open.title}
            onChange={(e) => update({ ...open, title: e.target.value })}
          />
          <select
            className="input"
            value={open.category}
            onChange={(e) => update({ ...open, category: e.target.value })}
          >
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <textarea
            className="input min-h-[300px] leading-relaxed"
            placeholder="Ingredients & method..."
            value={open.body}
            onChange={(e) => update({ ...open, body: e.target.value })}
          />
          <p className="text-xs text-rose-300">Last edited {new Date(open.updatedAt).toLocaleString()}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 space-y-4">
      <button onClick={addRecipe} className="btn-primary w-full">+ New recipe</button>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {["All", ...categories].map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              filter === c ? "bg-rose-500 text-white" : "bg-white text-rose-500 border border-rose-100"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <div className="card text-center text-rose-400">
          <p className="text-4xl mb-2">📒</p>
          <p className="text-sm">No recipes here yet.</p>
        </div>
      )}

      <div className="space-y-3">
        {visible.map((r) => (
          <button key={r.id} onClick={() => setOpenId(r.id)} className="card w-full text-left active:scale-[0.99] transition">
            <div className="flex justify-between items-start">
              <div className="min-w-0">
                <h3 className="font-display text-lg text-rose-700 truncate">{r.title}</h3>
                <p className="text-xs text-rose-400 mt-1 line-clamp-2">{r.body || "Tap to add ingredients & method..."}</p>
              </div>
              <span className="chip ml-2 shrink-0">{r.category}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
