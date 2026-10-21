import type { ReactNode } from "react";

interface Props {
  icon: ReactNode;
  title: string;
  hint?: ReactNode;
}

export function EmptyState({ icon, title, hint }: Props) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-stone-300 px-6 py-10 text-center">
      <div className="mb-3 grid size-9 place-items-center rounded-lg bg-white text-stone-500 ring-1 ring-stone-200">
        {icon}
      </div>
      <p className="text-sm font-medium text-stone-800">{title}</p>
      {hint && <p className="mt-1 max-w-xs text-sm text-stone-500">{hint}</p>}
    </div>
  );
}
