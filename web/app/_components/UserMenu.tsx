"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

interface Props {
  email: string;
  name: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
}

// The signed-in account menu on the right of the header. Matches the user
// dropdown in the Navbar Dropdowns design: an oxblood-tinted initials avatar,
// the name, and a panel with a name/email header, real destinations, and sign
// out. Every row is a route that exists — no invented per-user counts.
export function UserMenu({ email, name, avatarUrl, isAdmin }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut() {
    setOpen(false);
    await getSupabaseBrowser().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const displayName = name ?? email.split("@")[0];
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  const initials = (
    parts.length > 1 ? parts[0]!.slice(0, 1) + parts[parts.length - 1]!.slice(0, 1) : displayName.slice(0, 2)
  ).toUpperCase();

  const items: Array<{ href: string; label: string }> = [
    { href: "/dashboard", label: "Your monitors" },
    { href: "/manage", label: "Your ecosystems" },
    ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
  ];

  return (
    <div ref={ref} className="relative flex items-center">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex items-center gap-2.5 p-1 transition-opacity hover:opacity-80 focus:outline-none"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            width={30}
            height={30}
            className="h-[30px] w-[30px] flex-shrink-0 rounded-full border border-oxblood/25"
          />
        ) : (
          <span className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full border border-oxblood/25 bg-[#e7d3cd] font-mono text-[10px] font-semibold tracking-[0.04em] text-oxblood select-none">
            {initials}
          </span>
        )}
        <span className="hidden font-mono text-[11.5px] uppercase tracking-[0.1em] text-ink sm:block">
          {displayName}
        </span>
        <svg
          width="10"
          height="6"
          viewBox="0 0 10 6"
          fill="none"
          aria-hidden
          className={`hidden text-ink-faint transition-transform duration-200 sm:block ${open ? "rotate-180" : ""}`}
        >
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="panel-in absolute right-0 top-[calc(100%+8px)] z-50 w-[252px] overflow-hidden rounded-[10px] border hairline bg-parchment-50 shadow-[0_20px_44px_-14px_rgba(22,21,18,0.24)]">
          <div className="border-b border-rule-soft bg-[#f2ecdd] px-[18px] py-[15px]">
            <p className="font-serif text-[15px] normal-case text-ink">{displayName}</p>
            <p className="mt-0.5 font-mono text-[11px] normal-case tracking-normal text-ink-faint truncate">
              {email}
            </p>
          </div>
          <div className="py-[7px]">
            {items.map((it) => (
              <a
                key={it.href}
                href={it.href}
                onClick={() => setOpen(false)}
                className="block px-[18px] py-[9px] font-mono text-[12px] uppercase tracking-[0.05em] text-ink-muted transition-colors hover:bg-[#f1ebdb] hover:text-ink"
              >
                {it.label}
              </a>
            ))}
          </div>
          <div className="border-t border-rule-soft px-[18px] py-[11px]">
            <button
              onClick={signOut}
              className="p-0 font-mono text-[11px] uppercase tracking-[0.14em] text-oxblood transition-colors hover:text-oxblood-soft"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
