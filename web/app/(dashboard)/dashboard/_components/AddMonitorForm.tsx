"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ServerCombobox, normalizeServerRef, type ComboboxResult } from "@/app/_components/ServerCombobox";

export function AddMonitorForm() {
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function submitRef(server_ref: string, opts: { alreadyGraded: boolean }) {
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

    // Queue a grade request for servers we haven't graded yet, so the monitor
    // has something to alert on. (Body key is `target` — the route ignores
    // anything else.) Fire-and-forget; the monitor is already saved.
    if (!opts.alreadyGraded) {
      await fetch("/api/grade-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: server_ref }),
      }).catch(() => {});
    }

    setStatus("success");
    setMessage("Monitor added. We'll email you when the grade is ready.");
    setValue("");
    router.refresh();
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    submitRef(normalizeServerRef(value), { alreadyGraded: false });
  }

  return (
    <div className="border hairline bg-parchment-50 p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint mb-3">
        Add a server to monitor
      </p>
      <form onSubmit={onSubmit}>
        <div className="flex gap-2 items-start">
          <div className="flex-1 min-w-0">
            <ServerCombobox
              value={value}
              onValueChange={(v) => { setValue(v); setStatus("idle"); setMessage(""); }}
              onSelectResult={(r: ComboboxResult) => submitRef(r.target, { alreadyGraded: r.graded })}
              onSubmitFreeform={(normalized) => submitRef(normalized, { alreadyGraded: false })}
              searchKind="npm,pypi"
              placeholder="@scope/name or pypi/name"
              disabled={status === "loading"}
            />
          </div>

          <button
            type="submit"
            disabled={status === "loading" || !value.trim()}
            className="shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] bg-ink text-parchment px-4 py-2.5 hover:bg-oxblood transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {status === "loading" ? "…" : "Monitor"}
          </button>
        </div>

        <p className="mt-2 font-mono text-[10px] text-ink-faint">
          npm packages are prefixed automatically. Use <span className="text-ink">pypi/name</span> for PyPI.
        </p>

        {message && (
          <p
            role="alert"
            className={`mt-3 font-mono text-[11px] ${status === "error" ? "text-oxblood" : "text-ink-muted"}`}
          >
            {message}
          </p>
        )}
      </form>
    </div>
  );
}
