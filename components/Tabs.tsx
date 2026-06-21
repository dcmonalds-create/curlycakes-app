"use client";
export type TabKey = "lists" | "recipes";

export function Tabs({ tab, onChange }: { tab: TabKey; onChange: (t: TabKey) => void }) {
  const items: { k: TabKey; label: string; icon: string }[] = [
    { k: "lists", label: "Shopping", icon: "🛒" },
    { k: "recipes", label: "Recipes", icon: "📖" },
  ];
  return (
    <nav className="fixed bottom-3 left-1/2 -translate-x-1/2 z-20 bg-white/90 backdrop-blur border border-rose-100 shadow-soft rounded-full px-2 py-2 flex gap-1">
      {items.map((i) => (
        <button
          key={i.k}
          onClick={() => onChange(i.k)}
          className={`px-5 py-2 rounded-full text-sm font-semibold transition ${
            tab === i.k ? "bg-rose-500 text-white shadow-soft" : "text-rose-500"
          }`}
        >
          <span className="mr-1">{i.icon}</span>
          {i.label}
        </button>
      ))}
    </nav>
  );
}
