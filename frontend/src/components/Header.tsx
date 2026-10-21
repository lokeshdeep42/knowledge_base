import type { HealthState } from "../hooks/useHealth";
import { StatusBadge } from "./StatusBadge";

interface Props {
  health: HealthState;
  onRecheck: () => void;
}

export function Header({ health, onRecheck }: Props) {
  return (
    <header className="sticky top-0 z-10 border-b border-stone-200 bg-stone-50/85 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <svg aria-hidden viewBox="0 0 32 32" className="size-6">
            <rect width="32" height="32" rx="8" fill="var(--color-accent)" />
            <path
              d="M9 11.5h14M9 16h14M9 20.5h8"
              stroke="#fff"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </svg>
          <h1 className="text-[15px] font-semibold tracking-tight">Knowledge Inbox</h1>
        </div>
        <StatusBadge health={health} onRecheck={onRecheck} />
      </div>
    </header>
  );
}
