import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { emit, notifyGradeComputed, notifyVersionDetected } from "./events.js";

interface MockClient {
  rpc: ReturnType<typeof vi.fn>;
}

function mockSupabase(rpcImpl?: () => Promise<{ error: { message: string } | null }>): MockClient {
  return {
    rpc: vi.fn(async () => (rpcImpl ? rpcImpl() : { error: null })),
  };
}

describe("emit", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("calls polygraph_notify with channel + payload", async () => {
    const supa = mockSupabase();
    await emit(supa as unknown as SupabaseClient, "version_detected", {
      version_id: "v-1",
      server_id: "s-1",
    });
    expect(supa.rpc).toHaveBeenCalledWith("polygraph_notify", {
      channel: "version_detected",
      payload: { version_id: "v-1", server_id: "s-1" },
    });
  });

  it("logs and swallows errors so the caller can fire-and-forget", async () => {
    const supa = mockSupabase(() => Promise.resolve({ error: { message: "boom" } }));
    await expect(
      emit(supa as unknown as SupabaseClient, "grade_computed", {
        version_id: "v-1",
        kind: "adoption",
        new_value: 42,
      }),
    ).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/grade_computed emit failed.*boom/));
  });
});

describe("typed helpers", () => {
  it("notifyVersionDetected routes to the right channel", async () => {
    const supa = mockSupabase();
    await notifyVersionDetected(supa as unknown as SupabaseClient, {
      version_id: "v-1",
      server_id: "s-1",
    });
    expect(supa.rpc.mock.calls[0]?.[1]).toMatchObject({ channel: "version_detected" });
  });

  it("notifyGradeComputed routes to the right channel", async () => {
    const supa = mockSupabase();
    await notifyGradeComputed(supa as unknown as SupabaseClient, {
      version_id: "v-1",
      kind: "adoption",
      new_value: 73.2,
    });
    expect(supa.rpc.mock.calls[0]?.[1]).toMatchObject({ channel: "grade_computed" });
  });
});
