"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NAV_ITEMS, type NavItem } from "./navConfig";
import { useAuthUser, identityOf, accountItems, signOutAndRedirect } from "./useAuthUser";

// Mobile header + navigation. Below `lg` the desktop mega-menus and account slot
// are hidden, so this is the whole navigation: a bordered hamburger that toggles
// a full-width slide-down sheet. The sheet leads with the signed-in identity,
// then each primary section as an accordion carrying the same content the desktop
// dropdown shows, then the account actions (or a login link when signed out).
// Implements the Mobile screen of the Navbar Dropdowns design.

function extAttrs(external?: boolean) {
  return external ? { target: "_blank", rel: "noreferrer" as const } : {};
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="6"
      viewBox="0 0 10 6"
      fill="none"
      aria-hidden
      className={`text-ink-faint transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    >
      <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<string | null>(null);
  const auth = useAuthUser();
  const router = useRouter();

  const closeAll = () => {
    setOpen(false);
    setSection(null);
  };
  const toggleSection = (k: string) => setSection((s) => (s === k ? null : k));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function signOut() {
    closeAll();
    await signOutAndRedirect((href) => router.push(href));
    router.refresh();
  }

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={() => setOpen((o) => !o)}
        className="flex h-[44px] w-[44px] flex-col items-center justify-center gap-[5px] rounded-[9px] border hairline transition-colors hover:border-ink-faint"
      >
        <span
          className="block h-[1.6px] w-4 bg-ink transition-transform duration-200"
          style={{ transform: open ? "translateY(6.6px) rotate(45deg)" : "none" }}
        />
        <span
          className="block h-[1.6px] w-4 bg-ink transition-opacity duration-200"
          style={{ opacity: open ? 0 : 1 }}
        />
        <span
          className="block h-[1.6px] w-4 bg-ink transition-transform duration-200"
          style={{ transform: open ? "translateY(-6.6px) rotate(-45deg)" : "none" }}
        />
      </button>

      {open ? (
        <div
          id="mobile-nav"
          // Fill the viewport below the header (masthead is ~70px: 8px rule + the
          // row) so the sheet reads as a full page, not a floating dropdown.
          className="sheet-in absolute left-0 right-0 top-full z-50 h-[calc(100dvh-70px)] overflow-y-auto border-b hairline bg-parchment"
        >
          {auth.status === "authed" ? (
            <MobileAccountHeader email={auth.email} name={auth.name} avatarUrl={auth.avatarUrl} />
          ) : null}

          {NAV_ITEMS.map((item) => {
            const isOpen = section === item.key;
            return (
              <div key={item.key} className="border-b border-rule-soft">
                <button
                  type="button"
                  onClick={() => toggleSection(item.key)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-2.5 px-6 py-[17px] text-left"
                >
                  <span className="font-mono text-[13px] uppercase tracking-[0.14em] text-ink">{item.label}</span>
                  <Chevron open={isOpen} />
                </button>
                {isOpen ? <MobileSection item={item} onNavigate={closeAll} /> : null}
              </div>
            );
          })}

          {auth.status === "authed" ? (
            <div>
              <button
                type="button"
                onClick={() => toggleSection("account")}
                aria-expanded={section === "account"}
                className="flex w-full items-center justify-between gap-2.5 px-6 py-[17px] text-left"
              >
                <span className="font-mono text-[13px] uppercase tracking-[0.14em] text-ink">Account</span>
                <Chevron open={section === "account"} />
              </button>
              {section === "account" ? (
                <div className="acc-in px-6 pb-5">
                  {accountItems(auth.isAdmin).map((it) => (
                    <a
                      key={it.href}
                      href={it.href}
                      onClick={closeAll}
                      className="block border-t border-parchment-200 py-[11px] font-mono text-[12.5px] text-ink-muted transition-colors hover:text-ink"
                    >
                      {it.label}
                    </a>
                  ))}
                  <button
                    type="button"
                    onClick={signOut}
                    className="mt-3.5 w-full rounded-[9px] border hairline py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-oxblood transition-colors hover:text-oxblood-soft"
                  >
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <a
              href="/login"
              onClick={closeAll}
              className="flex items-center justify-between gap-2.5 px-6 py-[17px] font-mono text-[13px] uppercase tracking-[0.14em] text-ink transition-colors hover:text-oxblood"
            >
              Log in
              <span aria-hidden className="text-ink-faint">
                →
              </span>
            </a>
          )}
        </div>
      ) : null}
    </div>
  );
}

function MobileAccountHeader({
  email,
  name,
  avatarUrl,
}: {
  email: string;
  name: string | null;
  avatarUrl: string | null;
}) {
  const { displayName, initials } = identityOf(email, name);
  return (
    <div className="flex items-center gap-3 border-b border-rule-soft bg-[#f2ecdd] px-6 py-4">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={displayName}
          width={38}
          height={38}
          className="h-[38px] w-[38px] flex-shrink-0 rounded-full border border-oxblood/25"
        />
      ) : (
        <span className="flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-full border border-oxblood/25 bg-[#e7d3cd] font-mono text-[12px] font-semibold text-oxblood">
          {initials}
        </span>
      )}
      <span className="min-w-0">
        <span className="block font-serif text-[15px] leading-tight text-ink">{displayName}</span>
        <span className="block truncate font-mono text-[11px] normal-case tracking-normal text-ink-faint">
          {email}
        </span>
      </span>
    </div>
  );
}

function MobileSection({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const m = item.menu;
  return (
    <div className="acc-in px-6 pb-[22px] pt-0.5">
      {m.featured.map((f) => (
        <a
          key={f.title}
          href={f.href}
          onClick={onNavigate}
          {...extAttrs(f.external)}
          className="flex items-start gap-3 border-t border-parchment-200 py-[11px]"
        >
          <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[7px] border border-rule-soft bg-parchment-50 font-mono text-[12.5px] font-medium text-oxblood">
            {f.glyph}
          </span>
          <span className="min-w-0">
            <span className="block font-serif text-[15.5px] leading-[1.2] text-ink">{f.title}</span>
            <span className="mt-[3px] block text-[12px] leading-[1.45] text-ink-muted">{f.desc}</span>
          </span>
        </a>
      ))}

      <p className="mb-0.5 mt-4 font-mono text-[9.5px] uppercase tracking-[0.2em] text-ink-faint">{m.listLabel}</p>
      {m.list.map((it) => (
        <a
          key={it.name}
          href={it.href}
          onClick={onNavigate}
          {...extAttrs(it.external)}
          className="group flex items-center justify-between gap-3 border-t border-parchment-200 py-[9px]"
        >
          <span className="truncate font-mono text-[12.5px] text-ink transition-colors group-hover:text-oxblood">
            {it.name}
          </span>
          <span className="flex-shrink-0 font-mono text-[11px] tabular text-ink-faint transition-colors group-hover:text-oxblood">
            {it.meta ?? (it.external ? "↗" : "→")}
          </span>
        </a>
      ))}

      {m.subLinks && m.subLinks.length > 0 ? (
        <div className="my-[14px] flex flex-wrap gap-x-3.5 gap-y-2">
          {m.subLinks.map((s) => (
            <a
              key={s.label}
              href={s.href}
              onClick={onNavigate}
              {...extAttrs(s.external)}
              className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-faint transition-colors hover:text-oxblood"
            >
              {s.label}
            </a>
          ))}
        </div>
      ) : null}

      <a
        href={m.cta.href}
        onClick={onNavigate}
        {...extAttrs(m.cta.external)}
        className="relative mt-4 block rounded-[9px] bg-oxblood px-[17px] py-[15px] transition-colors hover:bg-oxblood-soft"
      >
        <span className="block pr-6 font-serif text-[16.5px] leading-[1.2] text-parchment">{m.cta.title}</span>
        <span className="mt-1.5 block font-mono text-[10.5px] leading-[1.45] text-parchment/70">{m.cta.desc}</span>
        <span aria-hidden className="absolute right-4 top-[15px] text-[15px] text-parchment">
          →
        </span>
      </a>
    </div>
  );
}
