"use client";
import { useMemo, useState } from "react";
import { useLocalState, uid } from "@/lib/storage";
import { UNITS, type Recipe, type Ingredient, type Unit, type ShoppingList, type Product } from "@/lib/types";
import { normalizeName } from "@/lib/aggregate";
import { PackEditor } from "@/components/PackEditor";

const DEFAULT_CATEGORIES = ["Sponge", "Cream", "Frosting", "Decoration", "Dough", "Other"];

export function Recipes() {
  const [recipes, setRecipes] = useLocalState<Recipe[]>("cc:recipes", []);
  const [lists, setLists] = useLocalState<ShoppingList[]>("cc:lists", []);
  const [products, setProducts] = useLocalState<Product[]>("cc:products", []);
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
    const r: Recipe = { id: uid(), title, category, body: "", ingredients: [], updatedAt: Date.now() };
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

  function addToList(recipe: Recipe, portions: number, listId: string | "__new__", newListName?: string) {
    const ing = recipe.ingredients ?? [];
    if (ing.length === 0) {
      alert("Add ingredients to this recipe first so the app can calculate quantities.");
      return false;
    }
    const scaled: Ingredient[] = ing.map((i) => ({
      id: uid(),
      name: i.name,
      qty: Math.round(i.qty * portions * 100) / 100,
      unit: i.unit,
    }));
    const cakeName = portions > 1 ? `${recipe.title} ×${portions}` : recipe.title;
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
        onBack={() => setOpenId(null)}
        onChange={update}
        onDelete={() => remove(open.id)}
        onAddToList={(p, lid, ln) => addToList(open, p, lid, ln)}
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
                <p className="text-xs text-rose-400 mt-1">
                  {(r.ingredients?.length ?? 0)} ingredients · 1 portion
                </p>
              </div>
              <span className="chip ml-2 shrink-0">{r.category}</span>
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
  onBack: () => void;
  onChange: (r: Recipe) => void;
  onDelete: () => void;
  onAddToList: (portions: number, listId: string | "__new__", newListName?: string) => boolean;
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
    const qty = Number(draft.qty);
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
        <button onClick={onDelete} className="text-xs text-rose-400">Delete</button>
      </div>

      <div className="card space-y-3">
        <input
          className="input font-display text-xl text-rose-700"
          value={recipe.title}
          onChange={(e) => onChange({ ...recipe, title: e.target.value })}
        />
        <select
          className="input"
          value={recipe.category}
          onChange={(e) => onChange({ ...recipe, category: e.target.value })}
        >
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="card space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-display text-rose-700">🥣 Ingredients</h3>
          <span className="chip">for 1 portion</span>
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
                  <input
                    className="input flex-1 text-right"
                    type="number"
                    inputMode="decimal"
                    value={i.qty === 0 ? "" : i.qty}
                    onChange={(e) => updateIng(i.id, { qty: e.target.value === "" ? 0 : Number(e.target.value) })}
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
                    className={`shrink-0 px-2 text-lg ${product ? "text-rose-500" : "text-rose-200"}`}
                    title={product ? `${product.packSize} ${product.packUnit} per ${product.packLabelSingular}` : "Set pack size"}
                  >📦</button>
                  <button onClick={() => removeIng(i.id)} className="shrink-0 text-rose-300 px-1">✕</button>
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
                  <p className="text-[11px] text-rose-400 pl-1">📦 {product.packSize} {product.packUnit} per {product.packLabelSingular}</p>
                )}
              </li>
            );
          })}
        </ul>

        <div className="pt-2 border-t border-rose-50 space-y-2">
          <input
            className="input"
            placeholder="Ingredient (e.g. Flour)"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <div className="flex gap-2 items-center">
            <input
              className="input flex-1 text-right"
              placeholder="Qty per portion"
              type="number"
              inputMode="decimal"
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
        <h3 className="font-display text-rose-700">📝 Method & notes</h3>
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
          lists={lists}
          onCancel={() => setShowAdder(false)}
          onConfirm={(portions, listId, newListName) => {
            const ok = onAddToList(portions, listId, newListName);
            if (ok) {
              setShowAdder(false);
              alert(`✨ Added to shopping list${portions > 1 ? ` (×${portions} portions)` : ""}.`);
            }
          }}
        />
      )}

      <p className="text-[11px] text-rose-300 text-right">Last edited {new Date(recipe.updatedAt).toLocaleString()}</p>
    </div>
  );
}

function AddToListPanel({
  recipeTitle,
  lists,
  onCancel,
  onConfirm,
}: {
  recipeTitle: string;
  lists: ShoppingList[];
  onCancel: () => void;
  onConfirm: (portions: number, listId: string | "__new__", newListName?: string) => void;
}) {
  const [portions, setPortions] = useState<number>(1);
  const [target, setTarget] = useState<string>(lists[0]?.id ?? "__new__");
  const [newListName, setNewListName] = useState<string>("");

  return (
    <div className="card space-y-3 border-2 border-rose-200">
      <h3 className="font-display text-rose-700">Add "{recipeTitle}" to a list</h3>

      <div>
        <label className="text-xs text-rose-500 font-semibold">Portions</label>
        <div className="flex gap-2 items-center mt-1">
          <button
            onClick={() => setPortions(Math.max(1, portions - 1))}
            className="btn-ghost !px-4 !py-2 text-lg"
          >−</button>
          <input
            className="input flex-1 text-center text-lg font-bold"
            type="number"
            inputMode="numeric"
            min={1}
            value={portions}
            onChange={(e) => setPortions(Math.max(1, Number(e.target.value) || 1))}
          />
          <button
            onClick={() => setPortions(portions + 1)}
            className="btn-ghost !px-4 !py-2 text-lg"
          >+</button>
        </div>
        <p className="text-[11px] text-rose-400 mt-1">
          All ingredients will be multiplied × {portions}
        </p>
      </div>

      <div>
        <label className="text-xs text-rose-500 font-semibold">Add to list</label>
        <select
          className="input mt-1"
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
          onClick={() => onConfirm(portions, target, target === "__new__" ? newListName : undefined)}
          className="btn-primary flex-1"
        >
          Add {portions} portion{portions > 1 ? "s" : ""}
        </button>
        <button onClick={onCancel} className="btn-ghost">Cancel</button>
      </div>
    </div>
  );
}
