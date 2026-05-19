import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { pollVersions } from "./poll-versions.js";

interface ServerSeed {
  id: string;
  registry: "npm" | "pypi";
  owner: string | null;
  name: string;
}

/**
 * Lightweight Supabase client mock supporting just the call chain
 * pollVersions and ensureVersionId use. The chain reflects supabase-js's
 * fluent builder — terminal awaits return a `{ data, error }`.
 */
function mockSupabase(opts: {
  servers: ServerSeed[];
  existingVersions: Set<string>; // `${server_id}|${version}` strings
}) {
  const inserted: Array<{ server_id: string; version: string }> = [];
  const rpcCalls: Array<{ channel: string; payload: unknown }> = [];

  const versionsByKey = new Map<string, string>(); // existing version_id by key
  for (const k of opts.existingVersions) {
    versionsByKey.set(k, `vid-${k.replace("|", "-")}`);
  }

  const client = {
    from: (table: string) => {
      if (table === "servers") {
        return {
          select: () => ({
            in: () => ({
              order: () => ({
                order: () => Promise.resolve({ data: opts.servers, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "versions") {
        return {
          select: (_cols: string) => ({
            eq: (_c1: string, server_id: string) => ({
              eq: (_c2: string, version: string) => ({
                maybeSingle: async () => {
                  const key = `${server_id}|${version}`;
                  const id = versionsByKey.get(key);
                  return { data: id ? { id } : null, error: null };
                },
              }),
            }),
          }),
          insert: (row: { server_id: string; version: string }) => ({
            select: () => ({
              single: async () => {
                inserted.push(row);
                const key = `${row.server_id}|${row.version}`;
                const id = `vid-${row.server_id}-${row.version}`;
                versionsByKey.set(key, id);
                return { data: { id }, error: null };
              },
            }),
          }),
        };
      }
      throw new Error(`unexpected from(${table})`);
    },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      if (fn === "polygraph_notify") {
        rpcCalls.push({ channel: String(args.channel), payload: args.payload });
      }
      return { error: null };
    },
  };

  return { client, inserted, rpcCalls };
}

describe("pollVersions", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("inserts new versions and emits version_detected only for the new ones", async () => {
    const mock = mockSupabase({
      servers: [
        { id: "s-1", registry: "npm", owner: "@x", name: "a" },
        { id: "s-2", registry: "npm", owner: null, name: "b" },
        { id: "s-3", registry: "pypi", owner: null, name: "c" },
      ],
      // s-1 already at version "1.0.0"; s-2 and s-3 have nothing yet.
      existingVersions: new Set(["s-1|1.0.0"]),
    });

    const result = await pollVersions(mock.client as unknown as SupabaseClient, {
      fetchLatestVersion: async (server) => {
        if (server.id === "s-1") return "1.0.0"; // same
        if (server.id === "s-2") return "0.4.2"; // new
        if (server.id === "s-3") return "2.1.0"; // new
        return null;
      },
    });

    expect(result.checked).toBe(3);
    expect(result.new_versions).toBe(2);
    expect(mock.inserted).toEqual([
      { server_id: "s-2", version: "0.4.2" },
      { server_id: "s-3", version: "2.1.0" },
    ]);
    expect(mock.rpcCalls).toHaveLength(2);
    expect(mock.rpcCalls.every((c) => c.channel === "version_detected")).toBe(true);
  });

  it("skips servers when the adapter returns no version", async () => {
    const mock = mockSupabase({
      servers: [{ id: "s-1", registry: "npm", owner: null, name: "missing-pkg" }],
      existingVersions: new Set(),
    });

    const result = await pollVersions(mock.client as unknown as SupabaseClient, {
      fetchLatestVersion: async () => null,
    });

    expect(result.checked).toBe(1);
    expect(result.new_versions).toBe(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.reason).toMatch(/no latest_version/);
    expect(mock.inserted).toEqual([]);
    expect(mock.rpcCalls).toEqual([]);
  });

  it("catches per-server adapter errors and proceeds with the rest", async () => {
    const mock = mockSupabase({
      servers: [
        { id: "s-1", registry: "npm", owner: null, name: "broken" },
        { id: "s-2", registry: "npm", owner: null, name: "fine" },
      ],
      existingVersions: new Set(),
    });

    const result = await pollVersions(mock.client as unknown as SupabaseClient, {
      fetchLatestVersion: async (server) => {
        if (server.id === "s-1") throw new Error("adapter exploded");
        return "1.0.0";
      },
    });

    expect(result.checked).toBe(2);
    expect(result.new_versions).toBe(1);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0]?.reason).toMatch(/adapter exploded/);
  });
});
