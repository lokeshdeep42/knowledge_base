import { LoaderCircle } from "lucide-react";

export function Spinner({ className = "size-4" }: { className?: string }) {
  return <LoaderCircle aria-hidden className={`${className} motion-safe:animate-spin`} />;
}
