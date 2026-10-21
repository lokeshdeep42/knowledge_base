import { FileText, Globe } from "lucide-react";
import type { Item } from "../api/types";
import { fullDate, hostOf, plural, relativeTime } from "../lib/format";

export function ItemCard({ item }: { item: Item }) {
  const isUrl = item.source_type === "url";
  const Icon = isUrl ? Globe : FileText;

  return (
    <article className="rounded-xl border border-stone-200 bg-white px-3.5 py-3 transition-colors hover:border-stone-300 motion-safe:animate-fade-in">
      <div className="flex items-start gap-2.5">
        <Icon
          role="img"
          aria-label={isUrl ? "Web page" : "Note"}
          className="mt-0.5 size-4 shrink-0 text-stone-400"
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-stone-900" title={item.title}>
            {item.title || "Untitled"}
          </h3>
          {isUrl && item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer noopener"
              className="block truncate text-xs text-stone-500 hover:text-accent hover:underline"
              title={item.url}
            >
              {hostOf(item.url)}
            </a>
          )}
          {item.preview && (
            <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-stone-600">
              {item.preview}
            </p>
          )}
          <p className="mt-2 flex items-center gap-1.5 font-mono text-[11px] text-stone-500">
            <time dateTime={item.created_at} title={fullDate(item.created_at)}>
              {relativeTime(item.created_at)}
            </time>
            <span aria-hidden>·</span>
            <span>{plural(item.chunk_count, "chunk")}</span>
          </p>
        </div>
      </div>
    </article>
  );
}
