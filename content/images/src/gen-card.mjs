#!/usr/bin/env node
/**
 * gen-card.mjs — render a shareable "terminal" grade card (PNG) from a real
 * litmus run. These cards are HTML/CSS mockups (see card.css) rendered by
 * headless Chromium — the look is templated, but the data is genuine harness
 * output, so every card is traceable to a reproducible grade.
 *
 * Modes:
 *   node gen-card.mjs <target> [opts]      grade <target> and render its card
 *   node gen-card.mjs --skill <dir> [opts] grade a Claude Code skill (static
 *                                          scan, no Docker) and render its card
 *   node gen-card.mjs --html <file> [opts] render an existing HTML (leaderboard,
 *                                          reproducibility) — no grading
 *
 * Options:
 *   --from-json <file>       use an existing `litmus --json` bundle (skip the run)
 *   --from-skill-json <file> use an existing `litmus-skill --json` bundle
 *   --name <display>         skill card: name shown on the card (default: dir name)
 *   --out <path>         output PNG (default: content/images/grade-<g>-<slug>.png)
 *   --caption "<text>"   editorial line under the card (default: grade-aware)
 *   --size <WxH>         render size (default 1500x820)
 *   --bearer <token>     passed through to litmus (OAuth remote targets)
 *   --header "K: V"      passed through to litmus (repeatable)
 *
 * Chromium: auto-detected from the Playwright cache or a system install.
 * Override with CHROME_BIN=/path/to/chrome.
 *
 * Examples:
 *   pnpm card npm/@modelcontextprotocol/server-filesystem
 *   pnpm card https://mcp.deepwiki.com/mcp --out content/images/deepwiki.png
 *   pnpm card --html content/images/src/leaderboard.html \
 *     --out content/images/06-popular-mcp-servers-leaderboard.png --size 1620x820
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const IMAGES_DIR = resolve(__dirname, "..");
const CSS = readFileSync(join(__dirname, "card.css"), "utf8");

// ---- arg parsing -----------------------------------------------------------
const argv = process.argv.slice(2);
const opts = { size: "1500x820", headers: [] };
let target = null;
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === "--html") opts.html = argv[++i];
  else if (a === "--from-json") opts.fromJson = argv[++i];
  else if (a === "--skill") opts.skill = argv[++i];
  else if (a === "--from-skill-json") opts.fromSkillJson = argv[++i];
  else if (a === "--name") opts.name = argv[++i];
  else if (a === "--cmd") opts.cmd = argv[++i];
  else if (a === "--out") opts.out = argv[++i];
  else if (a === "--caption") opts.caption = argv[++i];
  else if (a === "--size") opts.size = argv[++i];
  else if (a === "--bearer") opts.bearer = argv[++i];
  else if (a === "--header") opts.headers.push(argv[++i]);
  else if (a.startsWith("--")) die(`unknown option: ${a}`);
  else target = a;
}
const [W, H] = opts.size.split("x").map(Number);
if (!W || !H) die(`bad --size "${opts.size}" (expected WxH, e.g. 1500x820)`);

function die(msg) {
  console.error(`gen-card: ${msg}`);
  process.exit(1);
}

// ---- chromium resolver -----------------------------------------------------
function resolveChrome() {
  if (process.env.CHROME_BIN && existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  const home = process.env.HOME || "";
  const caches = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    join(home, "Library/Caches/ms-playwright"), // macOS
    join(home, ".cache/ms-playwright"), // Linux
  ].filter(Boolean);
  const wanted = ["chrome-headless-shell", "headless_shell", "Google Chrome for Testing", "Chromium", "chrome"];
  for (const cache of caches) {
    if (!existsSync(cache)) continue;
    // headless shells first (smallest, fastest), then full chromium
    const dirs = readdirSync(cache).sort((a, b) =>
      (b.startsWith("chromium_headless_shell") ? 1 : 0) - (a.startsWith("chromium_headless_shell") ? 1 : 0));
    for (const d of dirs) {
      const hit = findExec(join(cache, d), wanted, 4);
      if (hit) return hit;
    }
  }
  // system installs
  const sys = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ];
  for (const p of sys) if (existsSync(p)) return p;
  for (const bin of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    try { return execFileSync("which", [bin], { encoding: "utf8" }).trim(); } catch {}
  }
  die("no Chromium found. Set CHROME_BIN=/path/to/chrome, or install the Playwright browsers (npx playwright install chromium).");
}

function findExec(dir, names, depth) {
  if (depth < 0 || !existsSync(dir)) return null;
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return null; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isFile() && names.includes(e.name)) {
      try { if (statSync(p).mode & 0o111) return p; } catch {}
    }
  }
  for (const e of entries) {
    if (e.isDirectory()) {
      const hit = findExec(join(dir, e.name), names, depth - 1);
      if (hit) return hit;
    }
  }
  return null;
}

// ---- render ----------------------------------------------------------------
function render(htmlPath, outPath) {
  const chrome = resolveChrome();
  mkdirSync(dirname(outPath), { recursive: true });
  execFileSync(chrome, [
    "--headless", "--disable-gpu", "--hide-scrollbars",
    "--force-device-scale-factor=2", "--default-background-color=00000000",
    `--screenshot=${outPath}`, `--window-size=${W},${H}`,
    `file://${htmlPath}`,
  ], { stdio: "ignore" });
  if (!existsSync(outPath)) die(`render produced no file at ${outPath}`);
  return outPath;
}

// ---- data → card -----------------------------------------------------------
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const truncFp = (fp) => { const h = String(fp).replace(/^0x/, ""); return `0x${h.slice(0, 4)}…${h.slice(-4)}`; };

// Plain-English labels (mirror @polygraphso/litmus CATEGORY_META / SKILL_CATEGORY_META)
// so the card reads like the harness output, not a wall of probe codes.
const CATEGORY_META = {
  "C-01": "tool-output injection",
  "C-02": "permission / egress overreach",
  "C-03": "sensitive-data handling",
  "C-04": "adversarial-input handling",
};
const SKILL_CATEGORY_META = {
  "S-01": "prompt injection / context poisoning",
  "S-03": "data-exfiltration instructions",
  "S-04": "dangerous bundled commands",
  "S-05": "tool / permission overreach",
};

function statusColor(code, status) {
  return status === "pass" ? "var(--green)"
    : status === "fail" ? (code === "C-02" ? "var(--amber)" : "var(--red)")
    : status === "partial" ? "var(--amber)" : "var(--dim)";
}

// The `→ checks` block: one aligned row per category (code · label · status),
// mirroring the harness's readable output. `ch` columns keep the monospace
// label/status columns aligned regardless of label width, and a failing or
// skipped row is highlighted.
function checksBlock(cats, labels) {
  if (!cats.length) return "";
  const labelCols = Math.max(...cats.map((c) => (labels[c.code] || c.code).length)) + 2;
  const rows = cats
    .map((c) => {
      const label = labels[c.code] || c.code;
      const st = c.status === "skipped" ? "skipped" : c.status;
      const hl = c.status === "fail" || c.status === "skipped" ? " hl" : "";
      return (
        `<span class="chk${hl}" style="grid-template-columns:6ch ${labelCols}ch auto">` +
        `<span class="ccode">${esc(c.code)}</span>` +
        `<span class="clabel">${esc(label)}</span>` +
        `<span class="cstat" style="color:${statusColor(c.code, c.status)}">${esc(st)}</span>` +
        `</span>`
      );
    })
    .join("");
  return `<span class="line"><span class="arrow">→</span> checks</span><div class="checks">${rows}</div>`;
}

const DEFAULT_CAPTION = {
  A: "all four behavioral checks pass. the harness is open and deterministic — re-run it and you get the same grade.",
  B: "remote target — egress isn't observable without the sandbox, so it caps at B. the other checks pass.",
  D: "undeclared egress caught in the sandbox. no injection or data leak — a probe-cited, reproducible result.",
  F: "a disqualifying injection or data-leak failure. a dated, reproducible litmus measurement, not an accusation.",
};

function buildCardHtml(bundle, displayTarget) {
  const grade = bundle.grade;
  const caption = opts.caption ?? DEFAULT_CAPTION[grade] ?? "a reproducible litmus grade.";
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head>
<body>
  <div class="terminal">
    <div class="bar"><div class="dots"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span></div><div class="title">litmus — grade</div></div>
    <div class="pane">
      <div class="cmd cmd-sm"><span class="ps1">$ </span>npx -p @polygraphso/litmus polygraphso-litmus litmus ${esc(displayTarget)}</div>
      <div class="out">
        <span class="line"><span class="arrow">→</span> ${esc(bundle.methodologyVersion || "litmus")} · ${esc(bundle.serverRef)}</span>
        ${checksBlock(bundle.categories || [], CATEGORY_META)}
        <span class="line"><span class="arrow">→</span> fingerprint <span class="fp">${truncFp(bundle.toolDefsFingerprint)}</span></span>
        <span class="line"><span class="arrow">→</span> grade: <span class="grade ${grade}">${grade}</span></span>
        <span class="rationale">${esc(bundle.gradeRationale || "")}</span>
      </div>
    </div>
  </div>
  <div class="caption">${caption}</div>
  <div class="brand">polygraph · <b>${esc(bundle.methodologyVersion || "litmus")}</b></div>
</body></html>`;
}

const DEFAULT_SKILL_CAPTION = {
  A: "a static safety scan of a real, widely-used skill — clean. an A is a clean static scan, not behavioral proof.",
  B: "static checks pass, but a category couldn't be exercised — so it caps at B. an A needs every check to run.",
  D: "a dangerous bundled command, caught by a static scan. no injection or exfil instruction — capped at D.",
  F: "a disqualifying injection or exfil instruction in the skill body. a dated, reproducible static measurement.",
};

function buildSkillCardHtml(bundle, displayName, cmdArg) {
  const grade = bundle.grade;
  const caption = opts.caption ?? DEFAULT_SKILL_CAPTION[grade] ?? "a reproducible static safety grade.";
  const version = bundle.methodologyVersion || "litmus-skill-v1";
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head>
<body>
  <div class="terminal">
    <div class="bar"><div class="dots"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span></div><div class="title">litmus — skill</div></div>
    <div class="pane">
      <div class="cmd cmd-sm"><span class="ps1">$ </span>npx -p @polygraphso/litmus polygraphso-litmus-skill ${esc(cmdArg)}</div>
      <div class="out">
        <span class="line"><span class="arrow">→</span> ${esc(version)} · ${esc(displayName)}</span>
        ${checksBlock(bundle.categories || [], SKILL_CATEGORY_META)}
        <span class="line"><span class="arrow">→</span> hash <span class="fp">${truncFp(bundle.contentHash)}</span></span>
        <span class="line"><span class="arrow">→</span> grade: <span class="grade ${grade}">${grade}</span></span>
        <span class="rationale">${esc(bundle.gradeRationale || "")}</span>
      </div>
    </div>
  </div>
  <div class="caption">${caption}</div>
  <div class="brand">polygraph · <b>${esc(version)}</b></div>
</body></html>`;
}

function slug(serverRef) {
  return String(serverRef).replace(/^npm\//, "").replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase();
}

// ---- main ------------------------------------------------------------------
if (opts.html) {
  const out = opts.out || join(IMAGES_DIR, `${slug(opts.html.replace(/\.html$/, ""))}.png`);
  console.log(`rendering ${opts.html} → ${out} (${W}×${H})`);
  render(resolve(opts.html), resolve(out));
  console.log("done.");
} else if (opts.skill || opts.fromSkillJson) {
  // Skill card: static safety grade of a Claude Code skill (no execution).
  let safety;
  if (opts.fromSkillJson) {
    const j = JSON.parse(readFileSync(opts.fromSkillJson, "utf8"));
    safety = j.safety ?? j; // accept the {safety,quality} envelope or a bare safety bundle
  } else {
    const cliArgs = ["-y", "-p", "@polygraphso/litmus", "polygraphso-litmus-skill", opts.skill, "--json"];
    console.error(`running: npx ${cliArgs.join(" ")}`);
    const stdout = execFileSync("npx", cliArgs, {
      encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "inherit"],
    });
    safety = JSON.parse(stdout).safety;
  }
  const skillPath = opts.skill ? resolve(opts.skill).replace(/\/+$/, "") : null;
  const displayName = opts.name || basename(String(skillPath || safety.skillRef || "skill").replace(/\/+$/, ""));
  // The card shows the exact command a developer runs (zero-install npx), with the
  // home dir collapsed to ~ for legibility. Prefer the REAL graded path (--skill);
  // --cmd overrides; otherwise fall back to an honest <path-to-skill> placeholder —
  // never a guessed path that wouldn't resolve.
  const home = process.env.HOME || "";
  const cmdArg = opts.cmd
    || (skillPath ? (home && skillPath.startsWith(home) ? "~" + skillPath.slice(home.length) : skillPath) : "<path-to-skill>");
  const out = opts.out || join(IMAGES_DIR, `skill-${String(safety.grade).toLowerCase()}-${slug(displayName)}.png`);
  const tmp = join(tmpdir(), `pg-skill-card-${process.pid}.html`);
  writeFileSync(tmp, buildSkillCardHtml(safety, displayName, cmdArg));
  console.log(`skill ${safety.grade} · ${displayName} → ${out} (${W}×${H})`);
  render(tmp, resolve(out));
  console.log("done.");
} else {
  if (!target && !opts.fromJson) die("need a <target> (e.g. npm/@scope/name) or --from-json <file>. See --help in the header.");
  let bundle;
  if (opts.fromJson) {
    bundle = JSON.parse(readFileSync(opts.fromJson, "utf8"));
  } else {
    // Grade with the published @polygraphso/litmus (the package ships two bins,
    // so `-p … polygraphso-litmus` selects the CLI). Needs Docker for full C-02.
    const cliArgs = ["-y", "-p", "@polygraphso/litmus", "polygraphso-litmus", "litmus", target, "--json"];
    if (opts.bearer) cliArgs.push("--bearer", opts.bearer);
    for (const h of opts.headers) cliArgs.push("--header", h);
    console.error(`running: npx ${cliArgs.join(" ")}`);
    const stdout = execFileSync("npx", cliArgs, {
      encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "inherit"],
    });
    bundle = JSON.parse(stdout);
  }
  // bundle.target is a structured object, not a string — use the human ref.
  const displayTarget = target || bundle.serverRef;
  const out = opts.out || join(IMAGES_DIR, `grade-${String(bundle.grade).toLowerCase()}-${slug(bundle.serverRef)}.png`);
  const tmp = join(tmpdir(), `pg-card-${process.pid}.html`);
  writeFileSync(tmp, buildCardHtml(bundle, displayTarget));
  console.log(`grade ${bundle.grade} · ${bundle.serverRef} → ${out} (${W}×${H})`);
  render(tmp, resolve(out));
  console.log("done.");
}
