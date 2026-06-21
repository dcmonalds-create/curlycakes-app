"use client";
import { useMemo, useState } from "react";
import { useLocalState, uid } from "@/lib/storage";
import { UNITS, type ShoppingList, type Unit, type Ingredient, type Product } from "@/lib/types";
import { aggregate, buildShoppingMessage, normalizeName } from "@/lib/aggregate";
import { shareViaTelegram, copyText } from "@/lib/telegram";
import { PackEditor } from "@/components/PackEditor";

export function ShoppingLists() {
  const [lists, setLists] = useLocalState<ShoppingList[]>("cc:lists", []);
  const [products, setProducts] = useLocalState<Product[]>("cc:products", []);
  const [openListId, setOpenListId] = useState<string | null>(null);

  const openList = lists.find((l) => l.id === openListId) || null;

  function addList() {
    const name = prompt("Shopping list name (e.g. 'Saturday orders')")?.trim();
    if (!name) return;
    const l: ShoppingList = { id: uid(), name, createdAt: Date.now(), cakes: [] };
    setLists([l, ...lists]);
    setOpenListId(l.id);
  }

  function deleteList(id: string) {
    if (!confirm("Delete this list?")) return;
    setLists(lists.filter((l) => l.id !== id));
    if (openListId === id) setOpenListId(null);
  }

  function updateList(updated: ShoppingList) {
    setLists(lists.map((l) => (l.id === updated.id ? updated : l)));
  }

  function upsertProduct(p: Product) {
    setProducts([...products.filter((x) => x.name !== p.name), p]);
  }

  function removeProduct(name: string) {
    setProducts(products.filter((p) => p.name !== name));
  }

  if (openList) {
    return (
      <ListDetail
        list={openList}
        products={products}
        onBack={() => setOpenListId(null)}
        onChange={updateList}
        onDelete={() => deleteList(openList.id)}
        onUpsertProduct={upsertProduct}
        onRemoveProduct={removeProduct}
      />
    );
  }

  return (
    <div className="px-5 space-y-4">
      <button onClick={addList} className="btn-primary w-full text-base">+ New shopping list</button>

      {lists.length === 0 && (
        <div className="card text-center text-rose-400">
          <p className="text-4xl mb-2">🛍️</p>
          <p className="text-sm">No lists yet. Start with your next baking day!</p>
        </div>
      )}

      <div className="space-y-3">
        {lists.map((l) => (
          <button key={l.id} onClick={() => setOpenListId(l.id)} className="card w-full text-left active:scale-[0.99] transition">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-display text-lg text-rose-700">{l.name}</h3>
                <p className="text-xs text-rose-400 mt-1">
                  {l.cakes.length} cake{l.cakes.length !== 1 ? "s" : ""} • {l.cakes.reduce((s, c) => s + c.ingredients.length, 0)} ingredients
                </p>
              </div>
              <span className="chip">{new Date(l.createdAt).toLocaleDateString()}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ListDetail({
  list,
  products,
  onBack,
  onChange,
  onDelete,
  onUpsertProduct,
  onRemoveProduct,
}: {
  list: ShoppingList;
  products: Product[];
  onBack: () => void;
  onChange: (l: ShoppingList) => void;
  onDelete: () => void;
  onUpsertProduct: (p: Product) => void;
  onRemoveProduct: (name: string) => void;
}) {
  const [showTotals, setShowTotals] = useState(true);

  function addCake() {
    const name = prompt("Cake name (e.g. 'Strawberry vanilla')")?.trim();
    if (!name) return;
    onChange({ ...list, cakes: [...list.cakes, { id: uid(), name, ingredients: [] }] });
  }

  function updateCake(cakeId: string, patch: Partial<{ name: string; ingredients: Ingredient[] }>) {
    onChange({
      ...list,
      cakes: list.cakes.map((c) => (c.id === cakeId ? { ...c, ...patch } : c)),
    });
  }

  function deleteCake(cakeId: string) {
    if (!confirm("Remove this cake from the list?")) return;
    onChange({ ...list, cakes: list.cakes.filter((c) => c.id !== cakeId) });
  }

  const totals = useMemo(() => aggregate(list.cakes, products), [list.cakes, products]);

  async function share() {
    const totals = aggregate(list.cakes, products);
    if (totals.length === 0) {
      alert("Add ingredients to your cakes first — the list is empty ✨");
      return;
    }
    const msg = buildShoppingMessage(list.name, list.cakes, products);
    const result = await shareViaTelegram(msg);
    if (result === "browser-tab") {
      alert("Copied to clipboard & opened Telegram share — pick a chat.");
    } else if (result === "telegram-link") {
      // Telegram opened the share dialog natively; also copied as backup
    }
  }

  async function copy() {
    const ok = await copyText(buildShoppingMessage(list.name, list.cakes, products));
    alert(ok ? "Copied to clipboard ✨" : "Couldn't copy");
  }

  return (
    <div className="px-5 space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="btn-ghost text-sm">← Back</button>
        <button onClick={onDelete} className="text-xs text-rose-400">Delete list</button>
      </div>

      <div className="card">
        <input
          className="input font-display text-xl text-rose-700"
          value={list.name}
          onChange={(e) => onChange({ ...list, name: e.target.value })}
        />
      </div>

      <button onClick={addCake} className="btn-primary w-full">+ New cake</button>

      <div className="space-y-3">
        {list.cakes.map((c) => (
          <CakeCard
            key={c.id}
            cake={c}
            products={products}
            onChange={(p) => updateCake(c.id, p)}
            onDelete={() => deleteCake(c.id)}
            onUpsertProduct={onUpsertProduct}
            onRemoveProduct={onRemoveProduct}
          />
        ))}
      </div>

      {list.cakes.length > 0 && (
        <div className="card space-y-3">
          <button onClick={() => setShowTotals(!showTotals)} className="w-full flex justify-between items-center">
            <span className="font-display text-lg text-rose-700">✨ Total shopping list</span>
            <span className="chip">{totals.length} items</span>
          </button>
          {showTotals && (
            <ul className="space-y-2 text-sm text-rose-900">
              {totals.map((t, i) => (
                <li key={i} className="border-b border-rose-50 pb-2">
                  <div className="flex justify-between">
                    <span>{t.name}</span>
                    <span className="font-semibold">{t.qty} {t.unit}</span>
                  </div>
                  {t.pack && (
                    <div className="flex justify-end text-xs text-rose-500 mt-0.5">
                      → buy <span className="font-bold mx-1">{t.pack.count} {t.pack.label}</span>
                      <span className="text-rose-300">({t.pack.packSize} {t.pack.packUnit} each)</span>
                    </div>
                  )}
                  {t.unitMismatch && (
                    <div className="text-[11px] text-red-500 text-right mt-0.5">
                      ⚠ Pack saved in <b>{t.unitMismatch.packUnit}</b> but ingredient is in <b>{t.unitMismatch.ingredientUnit}</b> — re-open 📦 and match units
                    </div>
                  )}
                  {!t.pack && !t.unitMismatch && (
                    <div className="text-xs text-rose-300 text-right mt-0.5">📦 tap ingredient to set pack size</div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <button onClick={share} className="btn-primary flex-1">Send to Telegram</button>
            <button onClick={copy} className="btn-ghost">Copy</button>
          </div>
        </div>
      )}
    </div>
  );
}

function CakeCard({
  cake,
  products,
  onChange,
  onDelete,
  onUpsertProduct,
  onRemoveProduct,
}: {
  cake: { id: string; name: string; ingredients: Ingredient[] };
  products: Product[];
  onChange: (p: Partial<{ name: string; ingredients: Ingredient[] }>) => void;
  onDelete: () => void;
  onUpsertProduct: (p: Product) => void;
  onRemoveProduct: (name: string) => void;
}) {
  const [draft, setDraft] = useState<{ name: string; qty: string; unit: Unit }>({ name: "", qty: "", unit: "g" });
  const [packEditFor, setPackEditFor] = useState<string | null>(null);

  function add() {
    const name = draft.name.trim();
    const qty = Number(draft.qty);
    if (!name || !qty || qty <= 0) return;
    onChange({ ingredients: [...cake.ingredients, { id: uid(), name, qty, unit: draft.unit }] });
    setDraft({ name: "", qty: "", unit: draft.unit });
  }

  function update(id: string, patch: Partial<Ingredient>) {
    onChange({ ingredients: cake.ingredients.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
  }

  function remove(id: string) {
    onChange({ ingredients: cake.ingredients.filter((i) => i.id !== id) });
  }

  const productByName = (n: string) => products.find((p) => p.name === normalizeName(n));

  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xl">🎂</span>
        <input
          className="input flex-1 font-semibold text-rose-700"
          value={cake.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        <button onClick={onDelete} className="text-rose-300 text-sm px-2">✕</button>
      </div>

      <ul className="space-y-2">
        {cake.ingredients.map((i) => {
          const product = productByName(i.name);
          return (
            <li key={i.id} className="space-y-1">
              <input className="input" value={i.name} onChange={(e) => update(i.id, { name: e.target.value })} />
              <div className="flex gap-2 items-center">
                <input
                  className="input flex-1 text-right"
                  type="number"
                  inputMode="decimal"
                  value={i.qty === 0 ? "" : i.qty}
                  onChange={(e) => update(i.id, { qty: e.target.value === "" ? 0 : Number(e.target.value) })}
                />
                <select className="input flex-1" value={i.unit} onChange={(e) => update(i.id, { unit: e.target.value as Unit })}>
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
                <button
                  onClick={() => setPackEditFor(packEditFor === i.id ? null : i.id)}
                  className={`shrink-0 px-2 text-lg ${product ? "text-rose-500" : "text-rose-200"}`}
                  title={product ? `${product.packSize} ${product.packUnit} per ${product.packLabelSingular}` : "Set pack size"}
                >📦</button>
                <button onClick={() => remove(i.id)} className="shrink-0 text-rose-300 px-1">✕</button>
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
        <input className="input" placeholder="Ingredient (e.g. Milk)" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <div className="flex gap-2 items-center">
          <input
            className="input flex-1 text-right"
            placeholder="Qty"
            type="number"
            inputMode="decimal"
            value={draft.qty}
            onChange={(e) => setDraft({ ...draft, qty: e.target.value })}
          />
          <select className="input flex-1" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value as Unit })}>
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
          <button onClick={add} className="btn-primary !px-4 !py-2 shrink-0">+ Add</button>
        </div>
      </div>
    </div>
  );
}

