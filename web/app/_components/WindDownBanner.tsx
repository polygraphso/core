"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Sitewide wind-down notice. Rendered from the root layout, above the masthead,
// so it reaches a deep link to a report page or an ecosystem index and not just
// the homepage — most arrivals never see the front door.
//
// Dismissal is a per-browser convenience only: localStorage can throw (private
// window, blocked site data) or come back empty, and in that case the notice
// simply stays up. That is the safe direction for an announcement with a date
// on it. The server always renders the banner, so hydration matches and a
// previous dismisser loses it one frame after mount rather than seeing it flash
// on every navigation.
const KEY = "pg-winddown-dismissed";

export function WindDownBanner() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === "1") setDismissed(true);
    } catch {
      // Storage unavailable — leave the notice up.
    }
  }, []);

  if (dismissed) return null;

  function dismiss() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      // Storage unavailable — dismiss for this page view only.
    }
    setDismissed(true);
  }

  return (
    <aside
      aria-label="Site announcement"
      className="bg-oxblood text-parchment print:hidden"
    >
      <div className="mx-auto flex max-w-6xl items-start gap-4 px-6 py-2.5">
        <p className="flex-1 font-mono text-[11px] leading-[1.6] text-parchment/85">
          <span className="font-medium text-parchment">
            polygraph development and support end September 30, 2026.
          </span>{" "}
          {/* Dropped below `sm`: the strip is already three lines on a phone,
              and the link carries the rest of the message. */}
          <span className="hidden sm:inline">
            Published grades and the open harness stay available.{" "}
          </span>
          <Link
            href="/blog/winding-down"
            className="whitespace-nowrap text-parchment underline decoration-parchment/40 underline-offset-2 transition-colors hover:decoration-parchment"
          >
            Read the note &rarr;
          </Link>
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss announcement"
          className="-mr-1 shrink-0 px-1 font-mono text-[13px] leading-[1.35] text-parchment/60 transition-colors hover:text-parchment"
        >
          &times;
        </button>
      </div>
    </aside>
  );
}
