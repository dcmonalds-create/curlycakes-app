"use client";
export type TabKey = "lists" | "recipes" | "sizes";

export function Tabs({ tab, onChange }: { tab: TabKey; onChange: (t: TabKey) => void }) {
  const items: { k: TabKey; label: string }[] = [
    { k: "lists",   label: "Shopping" },
    { k: "recipes", label: "Recipes" },
    { k: "sizes",   label: "Sizes" },
  ];
  return (
    <nav className="fixed left-1/2 -translate-x-1/2 bottom-3 z-30 safe-bottom">
      <div className="flex gap-1 bg-surface/95 backdrop-blur-md border border-line rounded-full p-1 shadow-pop">
        {items.map((i) => {
          const active = tab === i.k;
          return (
            <button
              key={i.k}
              onClick={() => onChange(i.k)}
              className={`relative px-4 py-2 rounded-full text-[12px] font-semibold tracking-wide uppercase transition
                ${active ? "text-bg bg-ink" : "text-muted hover:text-ink"}`}
            >
              {i.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
