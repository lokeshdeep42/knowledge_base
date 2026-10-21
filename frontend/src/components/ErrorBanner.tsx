import { CircleAlert } from "lucide-react";

interface Props {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorBanner({ message, onRetry, retryLabel = "Try again" }: Props) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800 motion-safe:animate-fade-in"
    >
      <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />
      <p className="min-w-0 flex-1 break-words">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded font-medium text-red-900 underline decoration-red-300 underline-offset-2 hover:decoration-red-900"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
