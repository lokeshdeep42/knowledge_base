import { Inbox } from "lucide-react";
import type { Item } from "../api/types";
import { EmptyState } from "./EmptyState";
import { ErrorBanner } from "./ErrorBanner";
import { ItemCard } from "./ItemCard";

interface Props {
  items: Item[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

function ItemSkeleton() {
  return (
    <div className="rounded-xl border border-stone-200 bg-white px-3.5 py-3">
      <div className="flex gap-2.5 motion-safe:animate-pulse">
        <div className="size-4 rounded bg-stone-200" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-2/3 rounded bg-stone-200" />
          <div className="h-3 w-full rounded bg-stone-100" />
          <div className="h-3 w-4/5 rounded bg-stone-100" />
        </div>
      </div>
    </div>
  );
}

export function ItemList({ items, loading, error, onRetry }: Props) {
  if (error && items.length === 0) {
    return <ErrorBanner message={error} onRetry={onRetry} />;
  }

  if (loading && items.length === 0) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Loading saved items">
        <ItemSkeleton />
        <ItemSkeleton />
        <ItemSkeleton />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Inbox aria-hidden className="size-4" />}
        title="Your inbox is empty"
        hint="Save a note or a link above, then ask questions about it."
      />
    );
  }

  return (
    <ul className="space-y-2" aria-label="Saved items">
      {items.map((item) => (
        <li key={item.id}>
          <ItemCard item={item} />
        </li>
      ))}
    </ul>
  );
}
