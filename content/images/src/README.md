# Card generator — source

The shareable cards in `../` are **HTML/CSS mockups rendered to PNG by headless Chromium** — the terminal look is templated (`card.css`), but the *data* is real `litmus` output (from the published `@polygraphso/litmus` package), so every card is traceable to a reproducible grade. These are not screenshots of a live shell.

## Files

| File | What |
|------|------|
| `card.css` | the shared "terminal" stylesheet (grade cards + leaderboard) |
| `gen-card.mjs` | the generator — data-driven single-grade cards, or render a static HTML |
| `leaderboard.html` | source for `../06-popular-mcp-servers-leaderboard.png` (multi-server, hand-maintained) |
| `reproducibility.html` | source for `../05-reproducibility-same-fingerprint.png` (two runs, hand-maintained) |

## Generate a card

From the repo root:

```bash
# grade a server and render its card (needs Docker for the full C-02 sandbox)
pnpm card npm/@modelcontextprotocol/server-filesystem

# remote target (OAuth) — token is passed only to the target origin
pnpm card https://mcp.deepwiki.com/mcp
pnpm card https://mcp.example.com --bearer "$TOKEN"

# grade a Claude Code skill and render its card (static scan — no Docker)
pnpm card --skill ~/.claude/plugins/.../skills/frontend-design --name frontend-design

# reuse an existing `litmus --json` / `litmus-skill --json` bundle (no re-run)
pnpm card --from-json /tmp/bundle.json --out content/images/my-card.png
pnpm card --from-skill-json /tmp/skill.json --name frontend-design

# render a static template (leaderboard / reproducibility)
pnpm card --html content/images/src/leaderboard.html \
  --out content/images/06-popular-mcp-servers-leaderboard.png --size 1620x820
```

Options: `--out <path>`, `--caption "<text>"`, `--size <WxH>` (default `1500x820`), `--from-json <file>`, `--skill <dir>`, `--from-skill-json <file>`, `--name <display>`, `--bearer <token>`, `--header "K: V"`. Default output is `content/images/grade-<grade>-<slug>.png` (servers) or `content/images/skill-<grade>-<slug>.png` (skills).

The card mirrors the harness's readable output: a `→ checks` block with each category's plain-English label (`C-01 tool-output injection`, `S-01 prompt injection / context poisoning`, …) and status, a failing/skipped row highlighted.

**The `$ …` command on every card is a real, zero-install command a reader can run** — `npx -p @polygraphso/litmus polygraphso-litmus litmus <target>` (servers) / `… polygraphso-litmus-skill <path>` (skills) — not a display label. For skill cards the argument is the **actual graded path** (from `--skill <dir>`); `--cmd` overrides it, and with `--from-skill-json` and no `--cmd` it falls back to a literal `<path-to-skill>` placeholder rather than guessing a path that wouldn't resolve. So prefer `--skill <dir>` for a card you want to be copy-paste reproducible.

> **pnpm + flags:** positional targets forward fine (`pnpm card npm/x`). If pnpm ever swallows a `--flag`, add a `--` separator: `pnpm card npm/x -- --out z.png`. Or call the script directly: `node content/images/src/gen-card.mjs npm/x --out z.png`.

## How a card is built (data → PNG)

1. `npx -y -p @polygraphso/litmus polygraphso-litmus litmus <target> --json` → the evidence bundle (`grade`, `categories[].status`, `toolDefsFingerprint`, `gradeRationale`, `serverRef`). `pnpm card <target>` runs this for you.
2. `gen-card.mjs` fills the terminal template (CSS inlined) with those values.
3. Headless Chromium screenshots it at 2× → PNG.

## Chromium

Auto-detected from the Playwright browser cache (`~/Library/Caches/ms-playwright` or `~/.cache/ms-playwright`) or a system Chrome/Chromium. Override with `CHROME_BIN=/path/to/chrome`. If none is found, install one: `npx playwright install chromium`.

## Honesty

Cards name third-party servers with real grades — keep captions neutral and probe-cited, never "server X is unsafe." A failing grade is a dated, reproducible behavioral measurement of a specific version, not an accusation. See `../README.md` for the per-server notes.
