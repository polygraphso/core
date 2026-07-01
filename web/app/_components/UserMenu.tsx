"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

interface Props {
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

export function UserMenu({ email, name, avatarUrl }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  async function signOut() {
    setOpen(false);
    await getSupabaseBrowser().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const displayName = name ?? email.split("@")[0];
  const initial = displayName.slice(0, 1).toUpperCase();

  return (
    <div ref={ref} className="relative flex items-center">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex items-center gap-2 hover:opacity-80 transition-opacity focus:outline-none"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            width={24}
            height={24}
            className="w-6 h-6 rounded-full border hairline"
          />
        ) : (
          <span className="w-6 h-6 rounded-full bg-ink flex items-center justify-center font-mono text-[10px] text-parchment select-none">
            {initial}
          </span>
        )}
        <span className="hidden sm:block font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted">
          {displayName}
        </span>
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          className={`hidden sm:block text-ink-faint transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] w-52 bg-parchment border hairline z-50 shadow-sm">
          <div className="px-4 py-3 border-b hairline">
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint">Signed in as</p>
            <p className="font-mono text-[11px] text-ink mt-0.5 truncate">{email}</p>
          </div>
          <a
            href="/dashboard"
            onClick={() => setOpen(false)}
            className="block px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted hover:text-ink hover:bg-ink/[0.03] transition-colors"
          >
            Dashboard
          </a>
          <button
            onClick={signOut}
            className="w-full text-left px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-muted hover:text-ink hover:bg-ink/[0.03] transition-colors border-t hairline"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
