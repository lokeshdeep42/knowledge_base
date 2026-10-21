import { useCallback } from "react";
import type { IngestRequest } from "./api/types";
import { AddItemForm } from "./components/AddItemForm";
import { AskPanel } from "./components/AskPanel";
import { Header } from "./components/Header";
import { ItemList } from "./components/ItemList";
import { SectionHeading } from "./components/SectionHeading";
import { useHealth } from "./hooks/useHealth";
import { useItems } from "./hooks/useItems";

export default function App() {
  const { health, recheck } = useHealth();
  const { items, loading, error, refresh, addItem } = useItems();

  const handleAdd = useCallback(
    async (payload: IngestRequest) => {
      const item = await addItem(payload);
      // Saving proves the server is up; refresh the badge if it was marked offline.
      if (health.status !== "ok") recheck();
      return item;
    },
    [addItem, health.status, recheck],
  );

  return (
    <div className="min-h-dvh">
      <Header health={health} onRecheck={recheck} />

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[2fr_3fr] lg:gap-10 lg:py-8">
        <section aria-labelledby="inbox-heading" className="min-w-0">
          <SectionHeading
            id="inbox-heading"
            title="Inbox"
            meta={items.length > 0 ? items.length : undefined}
          />
          <div className="space-y-4">
            <AddItemForm onAdd={handleAdd} />
            <ItemList items={items} loading={loading} error={error} onRetry={refresh} />
          </div>
        </section>

        <section aria-labelledby="ask-heading" className="min-w-0">
          <SectionHeading id="ask-heading" title="Ask" />
          <AskPanel itemCount={items.length} />
        </section>
      </main>
    </div>
  );
}
