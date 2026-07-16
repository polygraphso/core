import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Guard against the "$1fee" / "$1one-time" class of spacing bug: a JSX
 * expression (a price/quote/count value) written directly against the next
 * word with no separating space, e.g. `{PRICE}fee` or `</span>fee`. It renders
 * glued and, even when a space is present, copies cleanly only when the value
 * isn't split across an inline boundary. We scan the money-facing copy files
 * and require every value expression that touches following text to be
 * separated by a space, an explicit {" "}, or punctuation.
 */

// Files that render user-facing prices/counts inline with prose.
const COPY_FILES = [
  "app/(public)/request/_components/RequestForm.tsx",
  "app/(public)/request/priority/[id]/page.tsx",
  "app/(public)/request/priority/[id]/_components/PriorityCheckout.tsx",
  "app/(public)/request/priority/[id]/_components/GradingProgress.tsx",
  "app/(public)/pricing/page.tsx",
];

// An expression closing `}` immediately followed by a letter, where the
// expression names a value (price/quote/amount/demand/count/grade/plan/term/
// usd). className/style/key/href braces never match these names.
const GLUED = /\{[^{}]*(?:price|quote|amount|demand|count|grade|plan|term|usd|fee)[^{}]*\}[A-Za-z]/i;

// An inline closing tag glued straight to a letter (no space, e.g. `</span>fee`).
const GLUED_TAG = /<\/(?:span|strong|code|a|Inline)>[A-Za-z]/;

describe("checkout copy has no glued price/word spacing bugs", () => {
  for (const rel of COPY_FILES) {
    it(`${rel} keeps a space after inline values`, () => {
      const src = readFileSync(join(process.cwd(), rel), "utf8");
      const offenders: string[] = [];
      for (const [re, label] of [
        [GLUED, "value-expression glued to a word"],
        [GLUED_TAG, "closing tag glued to a word"],
      ] as const) {
        src.split("\n").forEach((line, i) => {
          if (re.test(line)) offenders.push(`L${i + 1} (${label}): ${line.trim()}`);
        });
      }
      expect(offenders, offenders.join("\n")).toEqual([]);
    });
  }
});
