"use client";
export function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="px-5 pt-6 pb-3">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-300 to-rose-500 shadow-soft grid place-items-center text-white text-xl">
          🧁
        </div>
        <div>
          <h1 className="font-display text-2xl text-rose-700 leading-none">{title}</h1>
          {subtitle && <p className="text-xs text-rose-400 mt-1">{subtitle}</p>}
        </div>
      </div>
    </header>
  );
}
