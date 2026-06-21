"use client";
import { useMemo, useState } from "react";
import { useLocalState, uid } from "@/lib/storage";
import { UNITS, type ShoppingList, type Unit, type Ingredient, type Product } from "@/lib/types";
import { aggregate, buildShoppingMessage, normalizeName } from "@/lib/aggregate";
import { shareViaTelegram, copyText } from "@/lib/telegram";
import { PackEditor } from "@/components/PackEditor";
import { QtyInput } from "@/components/QtyInput";
import { parseQty } from "@/lib/qty";

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
    <div className="px-5 space-y-5">
      <button onClick={addList} className="btn-primary w-full">+ New shopping list</button>

      {lists.length === 0 && (
        <div className="card text-center py-10">
          <p className="font-display italic text-2xl text-muted mb-1">Nothing on the counter yet.</p>
          <p className="text-sm text-subtle">Start a list for your next baking day.</p>
        </div>
      )}

      <div className="space-y-3">
        {lists.map((l, idx) => {
          const ingCount = l.cakes.reduce((s, c) => s + c.ingredients.length, 0);
          return (
            <button key={l.id} onClick={() => setOpenListId(l.id)} className={`card w-full text-left active:scale-[0.99] transition rise rise-${Math.min(idx+1,3)}`}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-subtle">{new Date(l.createdAt).toLocaleDateString(undefined, { weekday: "long" })}</p>
                  <h3 className="font-display text-[22px] text-ink truncate mt-0.5">{l.name}</h3>
                  <p className="text-xs text-muted mt-1">
                    {l.cakes.length} cake{l.cakes.length !== 1 ? "s" : ""} · {ingCount} ingredient{ingCount !== 1 ? "s" : ""}
                  </p>
                </div>
                <span className="font-display text-3xl text-subtle">→</span>
              </div>
            </button>
          );
        })}
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
        <button onClick={onDelete} className="text-xs text-muted">Delete list</button>
      </div>

      <div className="card">
        <input
          className="input font-display text-xl text-ink"
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
        <div className="card space-y-3 relative overflow-hidden">
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-accent/10 blur-2xl pointer-events-none" />
          <button onClick={() => setShowTotals(!showTotals)} className="w-full flex justify-between items-baseline relative">
            <div className="text-left">
              <p className="text-[10px] uppercase tracking-[0.2em] text-subtle">Buy list</p>
              <span className="font-display text-2xl text-ink">Total shopping</span>
            </div>
            <span className="chip">{totals.length} items</span>
          </button>
          {showTotals && (
            <ul className="space-y-2 text-sm text-ink">
              {totals.map((t, i) => (
                <li key={i} className="border-b border-line pb-2">
                  <div className="flex justify-between">
                    <span>{t.name}</span>
                    <span className="font-semibold">{t.qty} {t.unit}</span>
                  </div>
                  {t.pack && (
                    <div className="flex justify-end text-xs text-muted mt-0.5">
                      → buy <span className="font-bold mx-1">{t.pack.count} {t.pack.label}</span>
                      <span className="text-subtle">({t.pack.packSize} {t.pack.packUnit} each)</span>
                    </div>
                  )}
                  {t.unitMismatch && (
                    <div className="text-[11px] text-warn text-right mt-0.5">
                      ⚠ Pack saved in <b>{t.unitMismatch.packUnit}</b> but ingredient is in <b>{t.unitMismatch.ingredientUnit}</b> — re-open 📦 and match units
                    </div>
                  )}
                  {!t.pack && !t.unitMismatch && (
                    <div className="text-xs text-subtle text-right mt-0.5">📦 tap ingredient to set pack size</div>
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
    const qty = parseQty(draft.qty);
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
      <div className="flex items-center gap-2 -mb-1">
        <p className="text-[10px] uppercase tracking-[0.2em] text-subtle flex-1">Cake</p>
        <button onClick={onDelete} className="text-subtle text-base px-1 leading-none">×</button>
      </div>
      <input
        className="input font-display text-xl text-ink"
        value={cake.name}
        onChange={(e) => onChange({ name: e.target.value })}
      />

      <ul className="space-y-2">
        {cake.ingredients.map((i) => {
          const product = productByName(i.name);
          return (
            <li key={i.id} className="space-y-1">
              <input className="input" value={i.name} onChange={(e) => update(i.id, { name: e.target.value })} />
              <div className="flex gap-2 items-center">
                <QtyInput
                  className="input flex-1 text-right"
                  value={i.qty}
                  onChange={(n) => update(i.id, { qty: n })}
                />
                <select className="input flex-1" value={i.unit} onChange={(e) => update(i.id, { unit: e.target.value as Unit })}>
                  {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
                <button
                  onClick={() => setPackEditFor(packEditFor === i.id ? null : i.id)}
                  className={`shrink-0 px-2 text-lg ${product ? "text-muted" : "text-subtle"}`}
                  title={product ? `${product.packSize} ${product.packUnit} per ${product.packLabelSingular}` : "Set pack size"}
                >📦</button>
                <button onClick={() => remove(i.id)} className="shrink-0 text-subtle px-1">✕</button>
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
        <input className="input" placeholder="Ingredient (e.g. Milk)" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
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
          <button onClick={add} className="btn-primary !px-4 !py-2 shrink-0">+ Add</button>
        </div>
      </div>
    </div>
  );
}

