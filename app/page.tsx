"use client";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Tabs, type TabKey } from "@/components/Tabs";
import { ShoppingLists } from "@/components/ShoppingLists";
import { Recipes } from "@/components/Recipes";
import { tg } from "@/lib/telegram";
import { useKeyboardAvoidance } from "@/lib/theme";

export default function Page() {
  const [tab, setTab] = useState<TabKey>("lists");
  useKeyboardAvoidance();

  useEffect(() => {
    const t = tg();
    if (t) { t.ready(); t.expand(); }
  }, []);

  const subtitle =
    tab === "lists" ? "One list, every cake, exact totals." : "Your recipes — categorised & portioned.";

  return (
    <div>
      <Header title="CurlyCakes" subtitle={subtitle} />
      <div className="px-5 mt-2 mb-4 rise rise-3">
        <div className="divider" />
      </div>
      {tab === "lists" ? <ShoppingLists /> : <Recipes />}
      <Tabs tab={tab} onChange={setTab} />
    </div>
  );
}
