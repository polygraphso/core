"use client";

/**
 * The account danger zone. Hard-deletes the account after a typed confirmation
 * (the user must type their email). When a paid plan is active, we warn first:
 * deleting the account does NOT stop the onchain stream, so they should cancel
 * the plan above to reclaim the remainder. On success we sign out and go home.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabaseBrowser";

export function DeleteAccount({
  email,
  hasActivePlan,
}: {
  email: string;
  hasActivePlan: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<"idle" | "deleting" | "error">("idle");
  const [message, setMessage] = useState("");

  const canDelete = confirm.trim().toLowerCase() === email.trim().toLowerCase();

  async function del() {
    setState("deleting");
    setMessage("");
    try {
      const res = await fetch("/api/account/delete", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Couldn't delete the account.");
      // Clear the (now-orphaned) session and leave the app.
      await getSupabaseBrowser().auth.signOut().catch(() => {});
      router.push("/?deleted=1");
    } catch (e) {
      setState("error");
      setMessage(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="font-mono text-[11px] uppercase tracking-[0.12em] text-oxblood border border-oxblood/40 rounded-[3px] px-4 py-2.5 hover:bg-oxblood hover:text-parchment transition-colors"
      >
        Delete account
      </button>
    );
  }

  return (
    <div className="border border-oxblood/40 rounded-[4px] px-5 py-4 max-w-xl">
      {hasActivePlan ? (
        <p className="mb-4 text-[13px] leading-relaxed text-ink border-l-2 border-oxblood pl-3">
          You have an active plan. Deleting your account does <span className="font-semibold">not</span>{" "}
          stop the onchain stream, and you&rsquo;ll lose the button to cancel it. Cancel your plan
          above first to reclaim the unstreamed remainder, then come back here.
        </p>
      ) : null}

      <label className="block">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-faint block mb-2">
          Type <span className="text-ink">{email}</span> to confirm
        </span>
        <input
          type="text"
          autoComplete="off"
          spellCheck={false}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={email}
          className="w-full bg-parchment border border-rule px-3.5 py-2.5 font-mono text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-oxblood transition-colors"
        />
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          disabled={!canDelete || state === "deleting"}
          onClick={() => void del()}
          className="font-mono text-[11px] uppercase tracking-[0.12em] bg-oxblood text-parchment rounded-[3px] px-4 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {state === "deleting" ? "Deleting…" : "Permanently delete"}
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setConfirm("");
            setState("idle");
            setMessage("");
          }}
          className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-muted hover:text-ink transition-colors"
        >
          Cancel
        </button>
      </div>

      {state === "error" ? (
        <p role="alert" className="mt-3 font-mono text-[11px] text-oxblood">
          {message}
        </p>
      ) : null}
    </div>
  );
}
