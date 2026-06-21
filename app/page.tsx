"use client";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Tabs, type TabKey } from "@/components/Tabs";
import { ShoppingLists } from "@/components/ShoppingLists";
import { Recipes } from "@/components/Recipes";
import { tg } from "@/lib/telegram";

export default function Page() {
  const [tab, setTab] = useState<TabKey>("lists");

  useEffect(() => {
    const t = tg();
    if (t) {
      t.ready();
      t.expand();
    }
  }, []);

  return (
    <div>
      <Header title="CurlyCakes" subtitle={tab === "lists" ? "Plan your bake — buy just enough." : "Your recipe notebook."} />
      {tab === "lists" ? <ShoppingLists /> : <Recipes />}
      <Tabs tab={tab} onChange={setTab} />
    </div>
  );
}
