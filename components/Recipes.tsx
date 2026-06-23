"use client";
import { useMemo, useState } from "react";
import { useLocalState, uid } from "@/lib/storage";
import { UNITS, type Recipe, type Ingredient, type Unit, type ShoppingList, type Product, type CakeSize } from "@/lib/types";
import { normalizeName } from "@/lib/aggregate";
import { PackEditor } from "@/components/PackEditor";
import { QtyInput } from "@/components/QtyInput";
import { parseQty } from "@/lib/qty";
import { DEFAULT_SIZE_TABLE, sortByDiameter, multiplierFor, scaleByDiameter, BASE_DIAMETER } from "@/lib/sizes";
import { tgConfirm, tgAlert } from "@/lib/telegram";

const DEFAULT_CATEGORIES = ["Sponge", "Cream", "Frosting", "Decoration", "Dough", "Other"];

export function Recipes() {
  const [recipes, setRecipes] = useLocalState<Recipe[]>("cc:recipes", []);
  const [lists, setLists] = useLocalState<ShoppingList[]>("cc:lists", []);
  const [products, setProducts] = useLocalState<Product[]>("cc:products", []);
  const [sizes] = useLocalState<CakeSize[]>("cc:sizes", DEFAULT_SIZE_TABLE);
  // null = never explicitly saved → fall back to defaults.
  // [] = user explicitly cleared all categories → show nothing.
  const [storedCategories, setStoredCategories] = useLocalState<string[] | null>("cc:categories", null);

  const orderedCategories = useMemo(() => {
    const base = storedCategories ?? DEFAULT_CATEGORIES;
    // Append any recipe categories not yet tracked
    const extra = recipes.map((r) => r.category).filter((c) => c && !base.includes(c));
    return extra.length ? [...base, ...extra] : base;
  }, [storedCategories, recipes]);

  function addCategory(name: string): void {
    if (name && !orderedCategories.includes(name)) {
      setStoredCategories([...orderedCategories, name]);
    }
  }

  const [filter, setFilter] = useState<string>("All");
  const [openId, setOpenId] = useState<string | null>(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  function upsertProduct(p: Product) {
    setProducts([...products.filter((x) => x.name !== p.name), p]);
  }
  function removeProduct(name: string) {
    setProducts(products.filter((p) => p.name !== name));
  }

  const categories = orderedCategories;

  const visible = filter === "All" ? recipes : recipes.filter((r) => r.category === filter);
  const open = recipes.find((r) => r.id === openId) || null;
  const [quickAddId, setQuickAddId] = useState<string | null>(null);
  const quickAddRecipe = recipes.find((r) => r.id === quickAddId) || null;

  function addRecipe() {
    const r: Recipe = {
      id: uid(), title: "New Recipe",
      category: orderedCategories[0] ?? "Other",
      body: "", ingredients: [],
      kind: "cake", baseDiameter: BASE_DIAMETER, basePortions: 1,
      updatedAt: Date.now(),
    };
    setRecipes([r, ...recipes]);
    setOpenId(r.id);
  }

  function update(updated: Recipe) {
    setRecipes(recipes.map((r) => (r.id === updated.id ? { ...updated, updatedAt: Date.now() } : r)));
  }

  async function remove(id: string) {
    if (!await tgConfirm("Delete this recipe?")) return;
    setRecipes(recipes.filter((r) => r.id !== id));
    if (openId === id) setOpenId(null);
  }

  type AddOpts =
    | { mode: "cake"; targetDiameter: number; multBy: number }
    | { mode: "other"; portions: number };

  function addToList(
    recipe: Recipe,
    opts: AddOpts,
    listId: string | "__new__",
    newListName?: string,
  ) {
    const ing = recipe.ingredients ?? [];
    if (ing.length === 0) {
      tgAlert("Add ingredients to this recipe first so the app can calculate quantities.");
      return false;
    }

    let scaled: Ingredient[];
    let cakeName: string;

    if (opts.mode === "cake") {
      const baseDiameter = recipe.baseDiameter ?? BASE_DIAMETER;
      const scaledByD = scaleByDiameter(ing, sizes, baseDiameter, opts.targetDiameter);
      scaled = scaledByD.map((i) => ({
        id: uid(), name: i.name,
        qty: Math.round(i.qty * opts.multBy * 100) / 100,
        unit: i.unit,
      }));
      cakeName = `${recipe.title} (${opts.targetDiameter} cm)${opts.multBy > 1 ? ` ×${opts.multBy}` : ""}`;
    } else {
      const basePortions = recipe.basePortions ?? 1;
      const factor = opts.portions / basePortions;
      scaled = ing.map((i) => ({
        id: uid(), name: i.name,
        qty: Math.round(i.qty * factor * 100) / 100,
        unit: i.unit,
      }));
      cakeName = opts.portions > 1 ? `${recipe.title} ×${opts.portions}` : recipe.title;
    }

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
        onAddToList={(opts, lid, ln) => addToList(open, opts, lid, ln)}
        onUpsertProduct={upsertProduct}
        onRemoveProduct={removeProduct}
        categories={categories}
        onAddCategory={addCategory}
      />
    );
  }

  return (
    <div className="px-5 space-y-4">
      <button onClick={addRecipe} className="btn-primary w-full">+ New recipe</button>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5">
        {["All", ...categories].map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition ${
              filter === c ? "bg-accent text-bg" : "bg-surface text-muted border border-line"
            }`}
          >
            {c}
          </button>
        ))}
        <button
          onClick={() => setShowCategoryManager(true)}
          className="shrink-0 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap bg-surface text-ink border border-dashed border-line"
          title="Manage categories"
        >⚙ Manage</button>
      </div>

      {visible.length === 0 && (
        <div className="card text-center py-10">
          <p className="font-display italic text-2xl text-muted mb-1">Your notebook is empty.</p>
          <p className="text-sm text-subtle">Add the first recipe.</p>
        </div>
      )}

      <div className="space-y-3">
        {visible.map((r, idx) => {
          const hasIngredients = (r.ingredients?.length ?? 0) > 0;
          return (
            <div key={r.id} className={`card flex items-stretch p-0 overflow-hidden rise rise-${Math.min(idx+1,3)}`}>
              <button
                onClick={() => setOpenId(r.id)}
                className="flex-1 text-left active:scale-[0.99] transition p-4 min-w-0"
              >
                <p className="text-[10px] uppercase tracking-[0.2em] text-subtle">{r.category}</p>
                <h3 className="font-display text-[22px] text-ink truncate mt-0.5">{r.title}</h3>
                <p className="text-xs text-muted mt-1">
                  {(r.ingredients?.length ?? 0)} ingredient{(r.ingredients?.length ?? 0) !== 1 ? "s" : ""} · {(r.kind ?? "cake") === "cake"
                    ? `for ${r.baseDiameter ?? BASE_DIAMETER} cm`
                    : `for ${r.basePortions ?? 1} portion${(r.basePortions ?? 1) !== 1 ? "s" : ""}`}
                </p>
              </button>
              <button
                onClick={() => {
                  if (!hasIngredients) { tgAlert("Add ingredients to this recipe first."); return; }
                  setQuickAddId(r.id);
                }}
                className="shrink-0 grid place-items-center w-14 border-l border-line text-muted hover:text-ink active:bg-surface-2 transition"
                title="Quick add to shopping list"
                aria-label="Quick add to shopping list"
              >
                <span className="text-lg leading-none">🛒</span>
                <span className="text-[10px] -mt-0.5">+</span>
              </button>
            </div>
          );
        })}
      </div>

      {showCategoryManager && (
        <CategoryManager
          categories={orderedCategories}
          onCategories={(cats) => setStoredCategories(cats)}
          onRecipes={(updater) => setRecipes(updater)}
          onClose={() => setShowCategoryManager(false)}
        />
      )}

      {quickAddRecipe && (
        <div
          className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm p-3 flex items-end sm:items-center justify-center"
          onClick={() => setQuickAddId(null)}
        >
          <div className="max-w-md w-full mx-auto" onClick={(e) => e.stopPropagation()}>
            <QuickAddPanel
              recipe={quickAddRecipe}
              lists={lists}
              onCancel={() => setQuickAddId(null)}
              onConfirm={(lid, ln) => {
                const isCake = (quickAddRecipe.kind ?? "cake") === "cake";
                const opts: { mode: "cake"; targetDiameter: number; multBy: number } | { mode: "other"; portions: number } = isCake
                  ? { mode: "cake", targetDiameter: quickAddRecipe.baseDiameter ?? BASE_DIAMETER, multBy: 1 }
                  : { mode: "other", portions: quickAddRecipe.basePortions ?? 1 };
                const ok = addToList(quickAddRecipe, opts, lid, ln);
                if (ok) {
                  setQuickAddId(null);
                  tgAlert(`✨ Added "${quickAddRecipe.title}".`);
                }
              }}
            />
          </div>
        </div>
      )}
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
  onAddCategory,
}: {
  recipe: Recipe;
  lists: ShoppingList[];
  products: Product[];
  sizes: CakeSize[];
  onBack: () => void;
  onChange: (r: Recipe) => void;
  onDelete: () => void;
  onAddToList: (
    opts: { mode: "cake"; targetDiameter: number; multBy: number } | { mode: "other"; portions: number },
    listId: string | "__new__",
    newListName?: string,
  ) => boolean;
  onAddCategory: (name: string) => void;
  onUpsertProduct: (p: Product) => void;
  onRemoveProduct: (name: string) => void;
  categories: string[];
}) {
  const ingredients = recipe.ingredients ?? [];
  const [draft, setDraft] = useState<{ name: string; qty: string; unit: Unit }>({ name: "", qty: "", unit: "g" });
  const [showAdder, setShowAdder] = useState<boolean>(false);
  const [packEditFor, setPackEditFor] = useState<string | null>(null);
  const [newCatDraft, setNewCatDraft] = useState<string | null>(null);

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
        {newCatDraft === null ? (
          <select
            className="input"
            value={recipe.category}
            onChange={(e) => {
              if (e.target.value === "__new__") { setNewCatDraft(""); return; }
              onChange({ ...recipe, category: e.target.value });
            }}
          >
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            <option value="__new__">＋ New category…</option>
          </select>
        ) : (
          <div className="flex gap-2">
            <input
              className="input flex-1"
              autoFocus
              placeholder="New category name"
              value={newCatDraft}
              onChange={(e) => setNewCatDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newCatDraft.trim()) {
                  onAddCategory(newCatDraft.trim());
                  onChange({ ...recipe, category: newCatDraft.trim() });
                  setNewCatDraft(null);
                } else if (e.key === "Escape") {
                  setNewCatDraft(null);
                }
              }}
            />
            <button
              onClick={() => {
                if (newCatDraft.trim()) {
                  onAddCategory(newCatDraft.trim());
                  onChange({ ...recipe, category: newCatDraft.trim() });
                }
                setNewCatDraft(null);
              }}
              className="btn-primary !px-3 !py-2 shrink-0"
            >Add</button>
            <button onClick={() => setNewCatDraft(null)} className="btn-ghost !px-3 !py-2 shrink-0">×</button>
          </div>
        )}

        <div className="flex gap-1 p-1 bg-surface-2 rounded-full">
          {(["cake", "other"] as const).map((k) => {
            const active = (recipe.kind ?? "cake") === k;
            return (
              <button
                key={k}
                onClick={() => onChange({ ...recipe, kind: k })}
                className={`flex-1 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wide transition
                  ${active ? "bg-ink text-bg" : "text-muted"}`}
              >
                {k === "cake" ? "Cake (by diameter)" : "Other (by portions)"}
              </button>
            );
          })}
        </div>

        {(recipe.kind ?? "cake") === "cake" ? (
          <label className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted">Base diameter</span>
            <select
              className="input flex-1"
              value={recipe.baseDiameter ?? BASE_DIAMETER}
              onChange={(e) => onChange({ ...recipe, baseDiameter: Number(e.target.value) })}
            >
              {sortByDiameter(sizes).map((s) => (
                <option key={s.id} value={s.diameter}>{s.diameter} cm</option>
              ))}
            </select>
          </label>
        ) : (
          <label className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-muted">Base portions</span>
            <input
              className="input flex-1 text-right"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={recipe.basePortions ?? 1}
              onChange={(e) => onChange({ ...recipe, basePortions: Math.max(1, Number(e.target.value.replace(/[^0-9]/g, "")) || 1) })}
            />
          </label>
        )}
      </div>

      <div className="card space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-display text-ink">🥣 Ingredients</h3>
          <span className="chip">
            {(recipe.kind ?? "cake") === "cake"
              ? `for ${recipe.baseDiameter ?? BASE_DIAMETER} cm`
              : `for ${recipe.basePortions ?? 1} portion${(recipe.basePortions ?? 1) !== 1 ? "s" : ""}`}
          </span>
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
        <div className="flex gap-2">
          <button onClick={onBack} className="btn-primary flex-1">
            ✓ Save
          </button>
          <button onClick={() => setShowAdder(true)} className="btn-ghost flex-1">
            🛒 Add to list
          </button>
        </div>
      ) : (
        <AddToListPanel
          recipe={recipe}
          sizes={sizes}
          lists={lists}
          onCancel={() => setShowAdder(false)}
          onConfirm={(opts, listId, newListName) => {
            const ok = onAddToList(opts, listId, newListName);
            if (ok) {
              setShowAdder(false);
              const note = opts.mode === "cake"
                ? `${opts.targetDiameter} cm${opts.multBy > 1 ? ` ×${opts.multBy}` : ""}`
                : `×${opts.portions} portion${opts.portions > 1 ? "s" : ""}`;
              tgAlert(`✨ Added (${note}).`);
            }
          }}
        />
      )}

      <p className="text-[11px] text-subtle text-right">Last edited {new Date(recipe.updatedAt).toLocaleString()}</p>
    </div>
  );
}

function QuickAddPanel({
  recipe,
  lists,
  onCancel,
  onConfirm,
}: {
  recipe: Recipe;
  lists: ShoppingList[];
  onCancel: () => void;
  onConfirm: (listId: string | "__new__", newListName?: string) => void;
}) {
  const [target, setTarget] = useState<string>(lists[0]?.id ?? "__new__");
  const [newListName, setNewListName] = useState<string>("");
  const isCake = (recipe.kind ?? "cake") === "cake";
  const baseHint = isCake
    ? `at base ${recipe.baseDiameter ?? BASE_DIAMETER} cm`
    : `at base ${recipe.basePortions ?? 1} portion${(recipe.basePortions ?? 1) !== 1 ? "s" : ""}`;

  return (
    <div className="card space-y-4 border-2 border-line">
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-subtle">Quick add</p>
        <h3 className="font-display text-xl text-ink mt-0.5">{recipe.title}</h3>
        <p className="text-[11px] text-muted mt-1">Will be added {baseHint}. Open the recipe to scale.</p>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-[0.2em] text-subtle">Add to list</label>
        <select className="input mt-2" value={target} onChange={(e) => setTarget(e.target.value)}>
          {lists.map((l) => (
            <option key={l.id} value={l.id}>{l.name} ({l.cakes.length})</option>
          ))}
          <option value="__new__">＋ New list…</option>
        </select>
        {target === "__new__" && (
          <input
            className="input mt-2"
            placeholder={`List name (e.g. "${recipe.title} order")`}
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
          />
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onConfirm(target, target === "__new__" ? newListName : undefined)}
          className="btn-primary flex-1"
        >
          Add to list
        </button>
        <button onClick={onCancel} className="btn-ghost">Cancel</button>
      </div>
    </div>
  );
}

type AddOpts =
  | { mode: "cake"; targetDiameter: number; multBy: number }
  | { mode: "other"; portions: number };

function AddToListPanel({
  recipe,
  sizes,
  lists,
  onCancel,
  onConfirm,
}: {
  recipe: Recipe;
  sizes: CakeSize[];
  lists: ShoppingList[];
  onCancel: () => void;
  onConfirm: (opts: AddOpts, listId: string | "__new__", newListName?: string) => void;
}) {
  const isCake = (recipe.kind ?? "cake") === "cake";
  const baseDiameter = recipe.baseDiameter ?? BASE_DIAMETER;
  const basePortions = recipe.basePortions ?? 1;
  const recipeIngredients = recipe.ingredients ?? [];

  const sorted = useMemo(() => sortByDiameter(sizes), [sizes]);
  const [diameter, setDiameter] = useState<number>(baseDiameter);
  const [multBy, setMultBy] = useState<number>(1);
  const [portions, setPortions] = useState<number>(basePortions);
  const [target, setTarget] = useState<string>(lists[0]?.id ?? "__new__");
  const [newListName, setNewListName] = useState<string>("");

  const baseMult = multiplierFor(sizes, baseDiameter);
  const targetMult = multiplierFor(sizes, diameter);
  const cakeFactor = baseMult > 0 ? (targetMult / baseMult) * multBy : multBy;
  const otherFactor = basePortions > 0 ? portions / basePortions : portions;

  const preview = useMemo(() => {
    if (isCake) {
      return scaleByDiameter(recipeIngredients, sizes, baseDiameter, diameter).map((i) => ({
        ...i, qty: Math.round(i.qty * multBy * 100) / 100,
      }));
    }
    return recipeIngredients.map((i) => ({
      ...i, qty: Math.round(i.qty * otherFactor * 100) / 100,
    }));
  }, [isCake, recipeIngredients, sizes, baseDiameter, diameter, multBy, otherFactor]);

  const confirm = () => {
    const opts: AddOpts = isCake
      ? { mode: "cake", targetDiameter: diameter, multBy }
      : { mode: "other", portions };
    onConfirm(opts, target, target === "__new__" ? newListName : undefined);
  };

  return (
    <div className="card space-y-4 border-2 border-line">
      <div>
        <p className="text-[10px] uppercase tracking-[0.2em] text-subtle">Add to shopping list</p>
        <h3 className="font-display text-xl text-ink mt-0.5">{recipe.title}</h3>
        <p className="text-[11px] text-muted mt-1">
          {isCake
            ? `Calibrated for ${baseDiameter} cm (×${baseMult}).`
            : `Calibrated for ${basePortions} portion${basePortions !== 1 ? "s" : ""}.`}
        </p>
      </div>

      {isCake ? (
        <>
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
              Scaling × <span className="font-semibold text-ink">{Math.round(cakeFactor * 100) / 100}</span>
              {" "}(base {baseMult} → target {targetMult}{multBy > 1 ? `, × ${multBy} cakes` : ""})
            </p>
          </div>

          <Stepper label="How many cakes?" value={multBy} onChange={setMultBy} />
        </>
      ) : (
        <Stepper label="Portions" value={portions} onChange={setPortions} />
      )}

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
            placeholder={`List name (e.g. "${recipe.title} order")`}
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
          />
        )}
      </div>

      <div className="flex gap-2">
        <button onClick={confirm} className="btn-primary flex-1">
          {isCake
            ? `Add ${diameter} cm${multBy > 1 ? ` ×${multBy}` : ""}`
            : `Add ×${portions} portion${portions > 1 ? "s" : ""}`}
        </button>
        <button onClick={onCancel} className="btn-ghost">Cancel</button>
      </div>
    </div>
  );
}

type CatEntry = { orig: string; name: string };

function CategoryManager({
  categories,
  onCategories,
  onRecipes,
  onClose,
}: {
  categories: string[];
  onCategories: (c: string[]) => void;
  onRecipes: (updater: (prev: Recipe[]) => Recipe[]) => void;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<CatEntry[]>(
    categories.map((c) => ({ orig: c, name: c }))
  );

  function move(idx: number, dir: -1 | 1) {
    const next = [...entries];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setEntries(next);
  }

  function rename(idx: number, val: string) {
    setEntries(entries.map((e, i) => (i === idx ? { ...e, name: val } : e)));
  }

  function remove(idx: number) {
    setEntries(entries.filter((_, i) => i !== idx));
  }

  function addNew() {
    setEntries([...entries, { orig: "", name: "" }]);
  }

  function save() {
    const valid = entries.filter((e) => e.name.trim());
    const newNames = valid.map((e) => e.name.trim());

    // Build rename map (original name → new name) for applying to recipes
    const renameMap = new Map<string, string>();
    valid.forEach(({ orig, name }) => {
      if (orig && orig !== name.trim()) renameMap.set(orig, name.trim());
    });

    // Categories that were deleted (in original list but not in survivors)
    const survivingOrigs = new Set(valid.map((e) => e.orig).filter(Boolean));
    const deletedOrigs = categories.filter((c) => !survivingOrigs.has(c));

    // Fallback for recipes in deleted categories: first surviving category, or ""
    const fallback = newNames[0] ?? "";

    // Use functional update so we operate on the live recipes state, not a stale prop snapshot
    onRecipes((currentRecipes) => {
      return currentRecipes.map((r) => {
        let cat = r.category;
        if (renameMap.has(cat)) cat = renameMap.get(cat)!;
        if (deletedOrigs.includes(cat)) cat = fallback;
        return cat !== r.category ? { ...r, category: cat } : r;
      });
    });

    onCategories(newNames);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm p-3 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="card max-w-md w-full mx-auto space-y-3 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center">
          <h3 className="font-display text-lg text-ink">Manage categories</h3>
          <button onClick={onClose} className="text-muted text-2xl leading-none px-1">×</button>
        </div>

        <p className="text-xs text-muted">Tap a name to rename it. Use ▲▼ to reorder.</p>

        <ul className="space-y-2">
          {entries.map((e, idx) => (
            <li key={idx} className="flex gap-1.5 items-center">
              <div className="flex flex-col gap-0">
                <button
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  className="text-[10px] leading-none text-subtle disabled:opacity-20 px-1 py-0.5"
                >▲</button>
                <button
                  onClick={() => move(idx, 1)}
                  disabled={idx === entries.length - 1}
                  className="text-[10px] leading-none text-subtle disabled:opacity-20 px-1 py-0.5"
                >▼</button>
              </div>
              <input
                className="input flex-1"
                value={e.name}
                placeholder="Category name"
                onChange={(ev) => rename(idx, ev.target.value)}
              />
              <button
                onClick={() => remove(idx)}
                className="shrink-0 text-subtle hover:text-ink text-xl px-1 leading-none"
                aria-label={`Delete ${e.name}`}
              >×</button>
            </li>
          ))}
        </ul>

        <button onClick={addNew} className="btn-ghost w-full text-sm">＋ Add category</button>

        <div className="flex gap-2 pt-1 border-t border-line">
          <button onClick={save} className="btn-primary flex-1">Save</button>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
        </div>
      </div>
    </div>
  );
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-[0.2em] text-subtle">{label}</label>
      <div className="flex gap-2 items-center mt-2">
        <button onClick={() => onChange(Math.max(1, value - 1))} className="btn-ghost !px-4 !py-2 text-lg">−</button>
        <input
          className="input flex-1 text-center text-lg font-bold"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={(e) => onChange(Math.max(1, Number(e.target.value.replace(/[^0-9]/g, "")) || 1))}
        />
        <button onClick={() => onChange(value + 1)} className="btn-ghost !px-4 !py-2 text-lg">+</button>
      </div>
    </div>
  );
}
