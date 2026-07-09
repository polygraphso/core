"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { TwitterAccount, TwitterThreadRow, TwitterThreadStatus } from "@/lib/twitterThreads";
import { xWeightedLength, TWEET_TARGET, TWEET_HARD_MAX } from "./charCount";

const STATUSES: TwitterThreadStatus[] = ["draft", "scheduled", "posted"];
const ACCOUNT_LABELS: Record<TwitterAccount, string> = {
  product: "@polygraphso",
  personal: "personal",
};

type EditTweet = { text: string; url: string; posted: boolean };

const inputCls =
  "w-full border hairline bg-transparent px-2.5 py-1.5 font-mono text-[12px] focus:outline-none focus:border-ink/40";

/** ISO (stored as UTC wall-clock) → datetime-local value, no tz shift. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return m ? `${m[1]}T${m[2]}` : "";
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="section-label block mb-1">{label}</span>
      {children}
    </label>
  );
}

function counterClass(len: number): string {
  if (len > TWEET_HARD_MAX) return "text-oxblood font-bold";
  if (len > TWEET_TARGET) return "text-oxblood";
  return "text-ink/40";
}

export function ThreadEditor({ thread }: { thread: TwitterThreadRow }) {
  const router = useRouter();

  const [title, setTitle] = useState(thread.title);
  const [slug, setSlug] = useState(thread.slug);
  const [status, setStatus] = useState<TwitterThreadStatus>(thread.status);
  const [account, setAccount] = useState<TwitterAccount>(thread.account);
  const [scheduledAt, setScheduledAt] = useState(toLocalInput(thread.scheduled_at));
  const [tweets, setTweets] = useState<EditTweet[]>(
    thread.tweets?.length
      ? thread.tweets.map((t) => ({ text: t.text, url: t.url ?? "", posted: !!t.posted }))
      : [{ text: "", url: "", posted: false }],
  );
  const [mainUrl, setMainUrl] = useState(thread.main_url ?? "");
  const [altText, setAltText] = useState(thread.alt_text ?? "");
  const [sources, setSources] = useState(thread.sources ?? "");
  const [notes, setNotes] = useState(thread.notes ?? "");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Image is stored in Storage and driven by the `thread` prop (updates on
  // router.refresh()), not local state — so it survives unsaved text edits.
  const [imgBusy, setImgBusy] = useState(false);
  const [imgMsg, setImgMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const liveCount = tweets.filter((t) => t.posted).length;

  async function copyThread() {
    const text = tweets.map((t) => t.text).join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setMsg({ kind: "err", text: "Copy failed" });
    }
  }

  function setTweet(i: number, patch: Partial<EditTweet>) {
    setTweets((prev) => prev.map((t, k) => (k === i ? { ...t, ...patch } : t)));
  }
  function addTweet() {
    setTweets((prev) => [...prev, { text: "", url: "", posted: false }]);
  }
  function removeTweet(i: number) {
    setTweets((prev) =>
      prev.length <= 1 ? [{ text: "", url: "", posted: false }] : prev.filter((_, k) => k !== i),
    );
  }
  function moveTweet(i: number, dir: -1 | 1) {
    setTweets((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/twitter/${thread.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          slug,
          status,
          account,
          scheduled_at: scheduledAt ? `${scheduledAt}:00Z` : null,
          tweets: tweets.map((t) => ({
            text: t.text,
            url: t.url.trim() || null,
            posted: t.posted,
          })),
          main_url: mainUrl.trim() || null,
          alt_text: altText,
          sources,
          notes,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ kind: "err", text: json.error ?? "Save failed" });
        return;
      }
      setMsg({ kind: "ok", text: "Saved" });
      router.refresh();
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Save failed" });
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!confirm("Delete this thread? This cannot be undone.")) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/twitter/${thread.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ kind: "err", text: json.error ?? "Delete failed" });
        setBusy(false);
        return;
      }
      router.push("/admin/twitter");
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Delete failed" });
      setBusy(false);
    }
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    setImgBusy(true);
    setImgMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/twitter/${thread.id}/image`, { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImgMsg(json.error ?? "Upload failed");
        return;
      }
      router.refresh();
    } catch (err) {
      setImgMsg(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setImgBusy(false);
    }
  }

  async function removeImage() {
    if (!confirm("Remove this image?")) return;
    setImgBusy(true);
    setImgMsg(null);
    try {
      const res = await fetch(`/api/admin/twitter/${thread.id}/image`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImgMsg(json.error ?? "Remove failed");
        return;
      }
      router.refresh();
    } catch (err) {
      setImgMsg(err instanceof Error ? err.message : "Remove failed");
    } finally {
      setImgBusy(false);
    }
  }

  async function copyImage() {
    if (!thread.image_url) return;
    try {
      const res = await fetch(thread.image_url, { cache: "no-store" });
      const blob = await res.blob();
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      setImgMsg("image copied");
      setTimeout(() => setImgMsg(null), 1500);
    } catch {
      setImgMsg("copy failed — use Copy URL");
    }
  }

  async function copyImageUrl() {
    if (!thread.image_url) return;
    try {
      await navigator.clipboard.writeText(thread.image_url);
      setImgMsg("url copied");
      setTimeout(() => setImgMsg(null), 1500);
    } catch {
      setImgMsg("copy failed");
    }
  }

  return (
    <div className="mt-3">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Thread title"
        className="w-full bg-transparent font-serif text-2xl text-ink mb-6 focus:outline-none border-b hairline pb-1"
      />

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        <Field label="Slug">
          <input value={slug} onChange={(e) => setSlug(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Account">
          <select
            value={account}
            onChange={(e) => setAccount(e.target.value as TwitterAccount)}
            className={inputCls}
          >
            {(Object.keys(ACCOUNT_LABELS) as TwitterAccount[]).map((a) => (
              <option key={a} value={a}>
                {ACCOUNT_LABELS[a]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as TwitterThreadStatus)}
            className={inputCls}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Scheduled (UTC)">
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>

      <div className="mb-6">
        <Field label="Thread URL (main tweet)">
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={mainUrl}
              onChange={(e) => setMainUrl(e.target.value)}
              placeholder="https://x.com/polygraphso/status/…"
              className={inputCls}
            />
            {mainUrl.trim() && (
              <a
                href={mainUrl}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 font-mono text-[11px] text-oxblood hover:underline"
              >
                open ↗
              </a>
            )}
          </div>
        </Field>
      </div>

      {/* Tweets */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <p className="section-label">
            Tweets ({tweets.length}
            {liveCount > 0 ? ` · ${liveCount} live` : ""})
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={copyThread}
              className="font-mono text-[11px] border px-2 py-1 hover:bg-ink/5"
            >
              {copied ? "✓ copied" : "Copy thread"}
            </button>
            <button
              type="button"
              onClick={addTweet}
              className="font-mono text-[11px] border px-2 py-1 hover:bg-ink/5"
            >
              + Add tweet
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {tweets.map((t, i) => {
            const len = xWeightedLength(t.text);
            return (
              <div
                key={i}
                className={`border hairline p-3 bg-parchment-50 ${
                  t.posted ? "border-l-2 border-l-oxblood" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-mono text-[11px] text-ink/50">
                    {i + 1}/{tweets.length}
                    {t.posted && <span className="ml-2 text-oxblood">● live</span>}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono text-[11px] tabular ${counterClass(len)}`}>
                      {len}/{TWEET_TARGET}
                    </span>
                    <button
                      type="button"
                      onClick={() => moveTweet(i, -1)}
                      disabled={i === 0}
                      className="font-mono text-[11px] border px-1.5 py-0.5 hover:bg-ink/5 disabled:opacity-30"
                      aria-label="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveTweet(i, 1)}
                      disabled={i === tweets.length - 1}
                      className="font-mono text-[11px] border px-1.5 py-0.5 hover:bg-ink/5 disabled:opacity-30"
                      aria-label="Move down"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => removeTweet(i)}
                      className="font-mono text-[11px] border px-1.5 py-0.5 hover:bg-ink/5 text-ink/60"
                      aria-label="Remove tweet"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <textarea
                  value={t.text}
                  onChange={(e) => setTweet(i, { text: e.target.value })}
                  rows={Math.max(3, t.text.split("\n").length + 1)}
                  className="w-full bg-transparent font-mono text-[13px] leading-relaxed resize-y focus:outline-none"
                  placeholder="Tweet text…"
                />
                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-rule/60">
                  <button
                    type="button"
                    onClick={() => setTweet(i, { posted: !t.posted })}
                    aria-pressed={t.posted}
                    className={`shrink-0 font-mono text-[11px] border px-2 py-1 hover:bg-ink/5 ${
                      t.posted ? "bg-oxblood/10 border-oxblood/40 text-oxblood" : "text-ink/60"
                    }`}
                  >
                    {t.posted ? "● live" : "○ mark live"}
                  </button>
                  <input
                    type="url"
                    value={t.url}
                    onChange={(e) => setTweet(i, { url: e.target.value })}
                    placeholder="https://x.com/polygraphso/status/…"
                    className="flex-1 border hairline bg-transparent px-2 py-1 font-mono text-[11px] focus:outline-none focus:border-ink/40"
                  />
                  {t.url.trim() && (
                    <a
                      href={t.url}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 font-mono text-[11px] text-oxblood hover:underline"
                    >
                      open ↗
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <Field label="Image alt text">
          <textarea
            value={altText}
            onChange={(e) => setAltText(e.target.value)}
            rows={6}
            className={`${inputCls} resize-y`}
          />
        </Field>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="section-label">Image</span>
            {imgMsg && <span className="font-mono text-[11px] text-ink/60">{imgMsg}</span>}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={onPickFile}
            className="hidden"
          />
          {thread.image_url ? (
            <div className="border hairline p-2 bg-parchment-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thread.image_url}
                alt={thread.alt_text ?? "thread image preview"}
                className="w-full max-h-72 object-contain border border-rule"
              />
              <p className="font-mono text-[10px] text-ink/50 mt-1.5 truncate">
                {thread.image_ref ?? "image"}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={copyImage}
                  disabled={imgBusy}
                  className="font-mono text-[11px] border px-2 py-1 hover:bg-ink/5 disabled:opacity-50"
                >
                  Copy image
                </button>
                <button
                  type="button"
                  onClick={copyImageUrl}
                  disabled={imgBusy}
                  className="font-mono text-[11px] border px-2 py-1 hover:bg-ink/5 disabled:opacity-50"
                >
                  Copy URL
                </button>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={imgBusy}
                  className="font-mono text-[11px] border px-2 py-1 hover:bg-ink/5 disabled:opacity-50"
                >
                  {imgBusy ? "…" : "Replace"}
                </button>
                <button
                  type="button"
                  onClick={removeImage}
                  disabled={imgBusy}
                  className="font-mono text-[11px] border px-2 py-1 hover:bg-ink/5 text-ink/60 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={imgBusy}
              className="w-full border hairline border-dashed py-8 font-mono text-[11px] text-ink/50 hover:bg-ink/5 disabled:opacity-50"
            >
              {imgBusy ? "uploading…" : "+ Upload image (PNG/JPG/WebP/GIF, ≤10 MB)"}
            </button>
          )}
        </div>
      </div>

      <div className="mb-6">
        <Field label="Sources">
          <textarea
            value={sources}
            onChange={(e) => setSources(e.target.value)}
            rows={5}
            className={`${inputCls} resize-y`}
          />
        </Field>
      </div>

      <div className="mb-8">
        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className={`${inputCls} resize-y`}
          />
        </Field>
      </div>

      <div className="flex items-center gap-3 border-t hairline pt-5">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="font-mono text-[12px] bg-oxblood text-parchment-50 px-4 py-2 hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={del}
          disabled={busy}
          className="font-mono text-[12px] border px-4 py-2 hover:bg-ink/5 text-ink/60 disabled:opacity-50"
        >
          Delete
        </button>
        {msg && (
          <span
            className={`font-mono text-[11px] ${msg.kind === "ok" ? "text-ink/60" : "text-oxblood"}`}
          >
            {msg.text}
          </span>
        )}
      </div>
    </div>
  );
}
