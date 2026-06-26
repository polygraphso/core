"use client";

import { useRouter } from "next/navigation";

/**
 * Returns to the last page visited (the report that linked here) via router
 * history, rather than hard-linking home. Falls back to the homepage when /fix
 * was the first entry — e.g. opened from a shared link — so it's never a dead end.
 */
export function BackButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) router.back();
        else router.push("/");
      }}
      className="inline-flex items-center gap-2 border hairline px-5 py-3 font-mono text-sm tracking-wide text-ink-muted hover:text-ink transition-colors"
    >
      ← Back
    </button>
  );
}
