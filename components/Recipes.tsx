"use client";
import { useMemo, useState } from "react";
import { useLocalState, uid } from "@/lib/storage";
import { UNITS, type Recipe, type Ingredient, type Unit, type ShoppingList, type Product, type CakeSize } from "@/lib/types";
import { normalizeName } from "@/lib/aggregate";
import { PackEditor } from "@/components/PackEditor";
import { QtyInput } from "@/components/QtyInput";
import { parseQty } from "@/lib/qty";
import { DEFAULT_SIZE_TABLE, sortByDiameter, multiplierFor, scaleByDiameter, BASE_DIAMETER } from "@/lib/sizes";

const DEFAULT_CATEGORIES = ["Sponge", "Cream", "Frosting", "Decoration", "Dough", "Other"];

export function Recipes() {
  const [recipes, setRecipes] = useLocalState<Recipe[]>("cc:recipes", []);
  const [lists, setLists] = useLocalState<ShoppingList[]>("cc:lists", []);
  const [products, setProducts] = useLocalState<Product[]>("cc:products", []);
  const [sizes] = useLocalState<CakeSize[]>("cc:sizes", DEFAULT_SIZE_TABLE);
  const [filter, setFilter] = useState<string>("All");
  const [openId, setOpenId] = useState<string | null>(null);

  function upsertProduct(p: Product) {
    setProducts([...products.filter((x) => x.name !== p.name), p]);
  }
  function removeProduct(name: string) {
    setProducts(products.filter((p) => p.name !== name));
  }

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
    const r: Recipe = { id: uid(), title, category, body: "", ingredients: [], baseDiameter: BASE_DIAMETER, updatedAt: Date.now() };
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

  function addToList(
    recipe: Recipe,
    targetDiameter: number,
    multiplyBy: number,
    listId: string | "__new__",
    newListName?: string,
  ) {
    const ing = recipe.ingredients ?? [];
    if (ing.length === 0) {
      alert("Add ingredients to this recipe first so the app can calculate quantities.");
      return false;
    }
    const baseDiameter = recipe.baseDiameter ?? BASE_DIAMETER;
    // First scale by diameter, then by integer count (e.g. two 22cm cakes).
    const scaledByD = scaleByDiameter(ing, sizes, baseDiameter, targetDiameter);
    const scaled: Ingredient[] = scaledByD.map((i) => ({
      id: uid(),
      name: i.name,
      qty: Math.round(i.qty * multiplyBy * 100) / 100,
      unit: i.unit,
    }));
    const cakeName =
      `${recipe.title} (${targetDiameter} cm)${multiplyBy > 1 ? ` ×${multiplyBy}` : ""}`;
    const cake = { id: uid(), name: cakeName, ingredients: scaled };

    if (listId === "__new__") {
      const name = (newListName?.trim()) || `${recipe.title} list`;
      const newList: ShoppingList = { id: uid(), name, createdAt: Date.now(), cakes: [cake] };
      setLists([newList, ...lists]);
    } else {
      setLists(lists.map((l) => (l.id === listId ? { ...l, cakes: [...l.cakes, cake] } : l)));
    }
    return true;
  }

  if (open) {
    return (
      <RecipeDetail
        recipe={open}
        lists={lists}
        products={products}
        sizes={sizes}
        onBack={() => setOpenId(null)}
        onChange={update}
        onDelete={() => remove(open.id)}
        onAddToList={(diameter, multBy, lid, ln) => addToList(open, diameter, multBy, lid, ln)}
        onUpsertProduct={upsertProduct}
        onRemoveProduct={removeProduct}
        categories={categories}
      />
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
              filter === c ? "bg-accent text-bg" : "bg-surface text-muted border border-line"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <div className="card text-center py-10">
          <p className="font-display italic text-2xl text-muted mb-1">Your notebook is empty.</p>
          <p className="text-sm text-subtle">Add the first recipe.</p>
        </div>
      )}

      <div className="space-y-3">
        {visible.map((r, idx) => (
          <button key={r.id} onClick={() => setOpenId(r.id)} className={`card w-full text-left active:scale-[0.99] transition rise rise-${Math.min(idx+1,3)}`}>
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.2em] text-subtle">{r.category}</p>
                <h3 className="font-display text-[22px] text-ink truncate mt-0.5">{r.title}</h3>
                <p className="text-xs text-muted mt-1">
                  {(r.ingredients?.length ?? 0)} ingredient{(r.ingredients?.length ?? 0) !== 1 ? "s" : ""} · for {r.baseDiameter ?? BASE_DIAMETER} cm
                </p>
              </div>
              <span className="font-display text-3xl text-subtle">→</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function RecipeDetail({
  recipe,
  lists,
  products,
  sizes,
  onBack,
  onChange,
  onDelete,
  onAddToList,
  onUpsertProduct,
  onRemoveProduct,
  categories,
}: {
  recipe: Recipe;
  lists: ShoppingList[];
  products: Product[];
  sizes: CakeSize[];
  onBack: () => void;
  onChange: (r: Recipe) => void;
  onDelete: () => void;
  onAddToList: (targetDiameter: number, multiplyBy: number, listId: string | "__new__", newListName?: string) => boolean;
  onUpsertProduct: (p: Product) => void;
  onRemoveProduct: (name: string) => void;
  categories: string[];
}) {
  const ingredients = recipe.ingredients ?? [];
  const [draft, setDraft] = useState<{ name: string; qty: string; unit: Unit }>({ name: "", qty: "", unit: "g" });
  const [showAdder, setShowAdder] = useState<boolean>(false);
  const [packEditFor, setPackEditFor] = useState<string | null>(null);

  const productByName = (n: string) => products.find((p) => p.name === normalizeName(n));

  function setIngredients(next: Ingredient[]) {
    onChange({ ...recipe, ingredients: next });
  }

  function addIngredient() {
    const name = draft.name.trim();
    const qty = parseQty(draft.qty);
    if (!name || !qty || qty <= 0) return;
    setIngredients([...ingredients, { id: uid(), name, qty, unit: draft.unit }]);
    setDraft({ name: "", qty: "", unit: draft.unit });
  }

  function updateIng(id: string, patch: Partial<Ingredient>) {
    setIngredients(ingredients.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }

  function removeIng(id: string) {
    setIngredients(ingredients.filter((i) => i.id !== id));
  }

  return (
    <div className="px-5 space-y-3">
      <div className="flex justify-between">
        <button onClick={onBack} className="btn-ghost text-sm">← Back</button>
        <button onClick={onDelete} className="text-xs text-muted">Delete</button>
      </div>

      <div className="card space-y-3">
        <input
          className="input font-display text-xl text-ink"
          value={recipe.title}
          onChange={(e) => onChange({ ...recipe, title: e.target.value })}
        />
        <div className="flex gap-2">
          <select
            className="input flex-1"
            value={recipe.category}
            onChange={(e) => onChange({ ...recipe, category: e.target.value })}
          >
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <label className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] uppercase tracking-wider text-muted">Base</span>
            <select
              className="input w-24"
              value={recipe.baseDiameter ?? BASE_DIAMETER}
              onChange={(e) => onChange({ ...recipe, baseDiameter: Number(e.target.value) })}
            >
              {sortByDiameter(sizes).map((s) => (
                <option key={s.id} value={s.diameter}>{s.diameter} cm</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="card space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-display text-ink">🥣 Ingredients</h3>
          <span className="chip">for {recipe.baseDiameter ?? BASE_DIAMETER} cm</span>
        </div>

        <ul className="space-y-2">
          {ingredients.map((i) => {
            const product = productByName(i.name);
            return (
              <li key={i.id} className="space-y-1">
                <input
                  className="input"
                  value={i.name}
                  onChange={(e) => updateIng(i.id, { name: e.target.value })}
                />
                <div className="flex gap-2 items-center">
                  <QtyInput
                    className="input flex-1 text-right"
                    value={i.qty}
                    onChange={(n) => updateIng(i.id, { qty: n })}
                  />
                  <select
                    className="input flex-1"
                    value={i.unit}
                    onChange={(e) => updateIng(i.id, { unit: e.target.value as Unit })}
                  >
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <button
                    onClick={() => setPackEditFor(packEditFor === i.id ? null : i.id)}
                    className={`shrink-0 px-2 text-lg ${product ? "text-muted" : "text-subtle"}`}
                    title={product ? `${product.packSize} ${product.packUnit} per ${product.packLabelSingular}` : "Set pack size"}
                  >📦</button>
                  <button onClick={() => removeIng(i.id)} className="shrink-0 text-subtle px-1">✕</button>
                </div>
                {packEditFor === i.id && (
                  <PackEditor
                    ingredientName={i.name}
                    existing={product}
                    defaultUnit={i.unit}
                    onSave={(p) => { onUpsertProduct(p); setPackEditFor(null); }}
                    onClear={product ? () => { onRemoveProduct(product.name); setPackEditFor(null); } : undefined}
                    onCancel={() => setPackEditFor(null)}
                  />
                )}
                {product && packEditFor !== i.id && (
                  <p className="text-[11px] text-muted pl-1">📦 {product.packSize} {product.packUnit} per {product.packLabelSingular}</p>
                )}
              </li>
            );
          })}
        </ul>

        <div className="pt-2 border-t border-line space-y-2">
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
            <select
              className="input flex-1"
              value={draft.unit}
              onChange={(e) => setDraft({ ...draft, unit: e.target.value as Unit })}
            >
              {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <button onClick={addIngredient} className="btn-primary !px-4 !py-2 shrink-0">+ Add</button>
          </div>
        </div>
      </div>

      <div className="card space-y-2">
        <h3 className="font-display text-ink">📝 Method & notes</h3>
        <textarea
          className="input min-h-[180px] leading-relaxed"
          placeholder="Mixing instructions, baking temp, decoration ideas…"
          value={recipe.body}
          onChange={(e) => onChange({ ...recipe, body: e.target.value })}
        />
      </div>

      {!showAdder ? (
        <button onClick={() => setShowAdder(true)} className="btn-primary w-full">
          🛒 Add to shopping list
        </button>
      ) : (
        <AddToListPanel
          recipeTitle={recipe.title}
          recipeIngredients={ingredients}
          baseDiameter={recipe.baseDiameter ?? BASE_DIAMETER}
          sizes={sizes}
          lists={lists}
          onCancel={() => setShowAdder(false)}
          onConfirm={(diameter, multBy, listId, newListName) => {
            const ok = onAddToList(diameter, multBy, listId, newListName);
            if (ok) {
              setShowAdder(false);
              alert(`✨ Added (${diameter} cm${multBy > 1 ? ` ×${multBy}` : ""}).`);
            }
          }}
        />
      )}

      <p className="text-[11px] text-subtle text-right">Last edited {new Date(recipe.updatedAt).toLocaleString()}</p>
    </div>
  );
}

function AddToListPanel({
  recipeTitle,
  recipeIngredients,
  baseDiameter,
  sizes,
  lists,
  onCancel,
  onConfirm,
}: {
  recipeTitle: string;
  recipeIngredients: Ingredient[];
  baseDiameter: number;
  sizes: CakeSize[];
  lists: ShoppingList[];
  onCancel: () => void;
  onConfirm: (targetDiameter: number, multiplyBy: number, listId: string | "__new__", newListName?: string) => void;
}) {
  const sorted = useMemo(() => sortByDiameter(sizes), [sizes]);
  const [diameter, setDiameter] = useState<number>(baseDiameter);
  const [multBy, setMultBy] = useState<number>(1);
  const [target, setTarget] = useState<string>(lists[0]?.id ?? "__new__");
  const [newListName, setNewListName] = useState<string>("");

  const baseMult = multiplierFor(sizes, baseDiameter);
  const targetMult = multiplierFor(sizes, diameter);
  const factor = baseMult > 0 ? (targetMult / baseMult) * multBy : multBy;

  const preview = useMemo(
    () => scaleByDiameter(recipeIngredients, sizes, baseDiameter, diameter).map((i) => ({
      ...i,
      qty: Math.round(i.qty * multBy * 100) / 100,
    })),
    [recipeIngredients, sizes, baseDiameter, diameter, multBy],
  );

  return (
    <div className="card space-y-4 border-2 border-line">
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-subtle">Add to shopping list</p>
        <h3 className="font-display text-xl text-ink mt-0.5">{recipeTitle}</h3>
        <p className="text-[11px] text-muted mt-1">Recipe is calibrated for {baseDiameter} cm (×{baseMult}).</p>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-[0.2em] text-subtle">Target diameter</label>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {sorted.map((s) => {
            const active = s.diameter === diameter;
            return (
              <button
                key={s.id}
                onClick={() => setDiameter(s.diameter)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition border
                  ${active ? "bg-ink text-bg border-ink" : "bg-surface text-ink border-line"}`}
              >
                {s.diameter}<span className={`ml-1 text-[10px] ${active ? "opacity-70" : "text-muted"}`}>cm · {s.people}p</span>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-muted mt-2">
          Scaling × <span className="font-semibold text-ink">{Math.round(factor * 100) / 100}</span>
          {" "}(base {baseMult} → target {targetMult}{multBy > 1 ? `, × ${multBy} cakes` : ""})
        </p>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-[0.2em] text-subtle">How many cakes?</label>
        <div className="flex gap-2 items-center mt-2">
          <button
            onClick={() => setMultBy(Math.max(1, multBy - 1))}
            className="btn-ghost !px-4 !py-2 text-lg"
          >−</button>
          <input
            className="input flex-1 text-center text-lg font-bold"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={multBy}
            onChange={(e) => setMultBy(Math.max(1, Number(e.target.value.replace(/[^0-9]/g, "")) || 1))}
          />
          <button
            onClick={() => setMultBy(multBy + 1)}
            className="btn-ghost !px-4 !py-2 text-lg"
          >+</button>
        </div>
      </div>

      {preview.length > 0 && (
        <details className="text-xs">
          <summary className="text-muted underline cursor-pointer">Preview scaled ingredients</summary>
          <ul className="mt-2 space-y-0.5 text-ink">
            {preview.map((i) => (
              <li key={i.id} className="flex justify-between">
                <span>{i.name}</span>
                <span className="font-mono">{i.qty} {i.unit}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <div>
        <label className="text-[10px] uppercase tracking-[0.2em] text-subtle">Add to list</label>
        <select
          className="input mt-2"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        >
          {lists.map((l) => (
            <option key={l.id} value={l.id}>{l.name} ({l.cakes.length})</option>
          ))}
          <option value="__new__">＋ New list…</option>
        </select>
        {target === "__new__" && (
          <input
            className="input mt-2"
            placeholder={`List name (e.g. "${recipeTitle} order")`}
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
          />
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onConfirm(diameter, multBy, target, target === "__new__" ? newListName : undefined)}
          className="btn-primary flex-1"
        >
          Add {diameter} cm{multBy > 1 ? ` ×${multBy}` : ""}
        </button>
        <button onClick={onCancel} className="btn-ghost">Cancel</button>
      </div>
    </div>
  );
}
