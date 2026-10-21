import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { FileText, Link2 } from "lucide-react";
import { errorMessage } from "../api/client";
import type { IngestRequest, Item } from "../api/types";
import { isHttpUrl } from "../lib/format";
import { fieldClass, primaryButtonClass } from "../lib/styles";
import { ErrorBanner } from "./ErrorBanner";
import { Spinner } from "./Spinner";

type Mode = "note" | "url";

const TABS: Array<{ mode: Mode; label: string; Icon: typeof FileText }> = [
  { mode: "note", label: "Note", Icon: FileText },
  { mode: "url", label: "URL", Icon: Link2 },
];

interface Props {
  onAdd: (payload: IngestRequest) => Promise<Item>;
}

export function AddItemForm({ onAdd }: Props) {
  const uid = useId();
  const [mode, setMode] = useState<Mode>("note");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedTitle, setSavedTitle] = useState<string | null>(null);
  const tabRefs = useRef<Record<Mode, HTMLButtonElement | null>>({ note: null, url: null });

  const trimmedUrl = url.trim();
  const canSubmit = !pending && (mode === "note" ? content.trim() !== "" : trimmedUrl !== "");

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setSavedTitle(null);
  }

  function onTabKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next: Mode = mode === "note" ? "url" : "note";
    switchMode(next);
    tabRefs.current[next]?.focus();
  }

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (!canSubmit) return;

    let payload: IngestRequest;
    if (mode === "note") {
      payload = { type: "note", content: content.trim() };
      if (title.trim()) payload.title = title.trim();
    } else {
      if (!isHttpUrl(trimmedUrl)) {
        setError("Enter a full web address starting with http:// or https://");
        return;
      }
      payload = { type: "url", url: trimmedUrl };
    }

    setPending(true);
    setError(null);
    setSavedTitle(null);
    try {
      const item = await onAdd(payload);
      if (mode === "note") {
        setTitle("");
        setContent("");
      } else {
        setUrl("");
      }
      setSavedTitle(item.title);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  const panelId = `${uid}-panel`;
  const errorId = `${uid}-error`;

  let status = "";
  if (pending) status = mode === "url" ? "Fetching and indexing the page…" : "Indexing note…";
  else if (savedTitle) status = `Saved “${savedTitle}”`;
  else if (mode === "note") status = "Ctrl+Enter to save";

  return (
    <form
      onSubmit={submit}
      aria-label="Add to inbox"
      className="rounded-xl border border-stone-200 bg-white p-3 sm:p-4"
    >
      <div
        role="tablist"
        aria-label="What to add"
        className="mb-3 inline-flex rounded-lg bg-stone-100 p-0.5"
      >
        {TABS.map(({ mode: m, label, Icon }) => {
          const selected = mode === m;
          return (
            <button
              key={m}
              ref={(el) => {
                tabRefs.current[m] = el;
              }}
              type="button"
              role="tab"
              id={`${uid}-tab-${m}`}
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              disabled={pending}
              onClick={() => switchMode(m)}
              onKeyDown={onTabKeyDown}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium transition-colors disabled:cursor-not-allowed ${
                selected
                  ? "bg-white text-stone-900 shadow-xs ring-1 ring-stone-200"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              <Icon aria-hidden className="size-3.5" />
              {label}
            </button>
          );
        })}
      </div>

      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={`${uid}-tab-${mode}`}
        className="space-y-2.5"
      >
        {mode === "note" ? (
          <>
            <label className="sr-only" htmlFor={`${uid}-title`}>
              Title (optional)
            </label>
            <input
              id={`${uid}-title`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (optional)"
              disabled={pending}
              maxLength={200}
              className={fieldClass}
            />
            <label className="sr-only" htmlFor={`${uid}-content`}>
              Note
            </label>
            <textarea
              id={`${uid}-content`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void submit();
                }
              }}
              placeholder="Paste or write a note…"
              rows={5}
              disabled={pending}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className={`${fieldClass} min-h-28 resize-y leading-relaxed`}
            />
          </>
        ) : (
          <>
            <label className="sr-only" htmlFor={`${uid}-url`}>
              Web address
            </label>
            <input
              id={`${uid}-url`}
              type="url"
              inputMode="url"
              autoComplete="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/article"
              disabled={pending}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              className={fieldClass}
            />
            <p className="text-xs text-stone-500">
              The page is fetched and its readable text is saved.
            </p>
          </>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-xs text-stone-500" aria-live="polite">
          {status}
        </p>
        <button type="submit" disabled={!canSubmit} className={`${primaryButtonClass} shrink-0`}>
          {pending && <Spinner className="size-3.5" />}
          {pending ? "Saving" : mode === "note" ? "Save note" : "Save link"}
        </button>
      </div>

      {error && (
        <div id={errorId} className="mt-3">
          <ErrorBanner message={error} />
        </div>
      )}
    </form>
  );
}
