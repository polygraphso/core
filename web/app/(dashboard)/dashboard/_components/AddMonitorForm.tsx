"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ServerCombobox, normalizeServerRef, type ComboboxResult } from "@/app/_components/ServerCombobox";
import { normalizeSkillInput } from "@/lib/skillGrades";

type Kind = "server" | "skill";

export function AddMonitorForm() {
  const [kind, setKind] = useState<Kind>("server");
  const [value, setValue] = useState("");
  const [skillValue, setSkillValue] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function submitRef(server_ref: string, opts: { alreadyGraded: boolean; isSkill: boolean }) {
    setStatus("loading");
    setMessage("");

    const res = await fetch("/api/monitor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ server_ref }),
    });
    const body = (await res.json()) as { ok: boolean; message?: string };

    if (!res.ok) {
      setStatus("error");
      setMessage(body.message ?? "Something went wrong.");
      return;
    }

    // Queue a grade request for an ungraded SERVER so the monitor has something to
    // alert on. Skills go through a different grading path (and the monitor engine
    // grades a github target it's watching), so skip it for skills.
    if (!opts.isSkill && !opts.alreadyGraded) {
      await fetch("/api/grade-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: server_ref }),
      }).catch(() => {});
    }

    setStatus("success");
    setMessage(
      opts.alreadyGraded
        ? "Monitor added. We'll email you when its grade changes."
        : "Monitor added. We'll email you when the grade is ready.",
    );
    setValue("");
    setSkillValue("");
    router.refresh();
  }

  function onSubmitServer(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    submitRef(normalizeServerRef(value), { alreadyGraded: false, isSkill: false });
  }

  function submitSkill(normalized: string) {
    if (!normalized.startsWith("github/") || !normalized.includes("#")) {
      setStatus("error");
      setMessage("Pick a skill from the list, or paste github/owner/repo#skill or a SKILL.md URL.");
      return;
    }
    submitRef(normalized, { alreadyGraded: false, isSkill: true });
  }

  function onSubmitSkill(e: React.FormEvent) {
    e.preventDefault();
    if (!skillValue.trim()) return;
    submitSkill(normalizeSkillInput(skillValue));
  }

  const tab = (k: Kind, label: string) => (
    <button
      type="button"
      onClick={() => { setKind(k); setStatus("idle"); setMessage(""); }}
      aria-pressed={kind === k}
      className={`font-mono text-[10px] uppercase tracking-[0.14em] px-3 py-1.5 border border-rule rounded-[3px] transition-colors ${
        kind === k ? "bg-ink border-ink text-parchment" : "bg-parchment-50 text-ink-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );

  const monitorButton = (formValue: string) => (
    <button
      type="submit"
      disabled={status === "loading" || !formValue.trim()}
      className="shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] bg-ink text-parchment rounded-[3px] px-4 py-2.5 hover:bg-oxblood transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {status === "loading" ? "…" : "Monitor"}
    </button>
  );

  return (
    <div className="border border-rule rounded-[4px] p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
          Add a monitor
        </p>
        <div className="flex gap-1.5">
          {tab("server", "MCP server")}
          {tab("skill", "Skill")}
        </div>
      </div>

      {kind === "server" ? (
        <form onSubmit={onSubmitServer}>
          <div className="flex gap-2 items-start">
            <div className="flex-1 min-w-0">
              <ServerCombobox
                value={value}
                onValueChange={(v) => { setValue(v); setStatus("idle"); setMessage(""); }}
                onSelectResult={(r: ComboboxResult) => submitRef(r.target, { alreadyGraded: r.graded, isSkill: false })}
                onSubmitFreeform={(normalized) => submitRef(normalized, { alreadyGraded: false, isSkill: false })}
                searchKind="npm,pypi"
                placeholder="@scope/name or pypi/name"
                disabled={status === "loading"}
              />
            </div>
            {monitorButton(value)}
          </div>
          <p className="mt-2 font-mono text-[10px] text-ink-faint">
            npm packages are prefixed automatically. Use <span className="text-ink">pypi/name</span> for PyPI, or{" "}
            <span className="text-ink">github/owner/repo</span> for a github server.
          </p>
        </form>
      ) : (
        <form onSubmit={onSubmitSkill}>
          <div className="flex gap-2 items-start">
            <div className="flex-1 min-w-0">
              <ServerCombobox
                value={skillValue}
                onValueChange={(v) => { setSkillValue(v); setStatus("idle"); setMessage(""); }}
                onSelectResult={(r: ComboboxResult) => submitRef(r.target, { alreadyGraded: r.graded, isSkill: true })}
                onSubmitFreeform={(normalized) => submitSkill(normalized)}
                searchUrl="/api/skills/search"
                normalize={normalizeSkillInput}
                placeholder="Search skills, or paste a github ref / SKILL.md URL"
                freeformVerb="Monitor"
                disabled={status === "loading"}
              />
            </div>
            {monitorButton(skillValue)}
          </div>
          <p className="mt-2 font-mono text-[10px] text-ink-faint">
            Search graded skills by name, or paste{" "}
            <span className="text-ink">github/owner/repo#skill</span> or a full SKILL.md URL. Browse them on{" "}
            <a href="/bankr" className="text-ink hover:text-oxblood underline decoration-dotted underline-offset-2">/bankr</a>{" "}
            and other ecosystem pages.
          </p>
        </form>
      )}

      {message && (
        <p
          role="alert"
          className={`mt-3 font-mono text-[11px] ${status === "error" ? "text-oxblood" : "text-ink-muted"}`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
