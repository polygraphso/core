import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentIdentity } from "@/lib/agentIdentity";

/**
 * Transport-agnostic context for the lookup helpers. Both the public
 * /api/cli/* routes and the hosted MCP endpoint build one of these and call
 * the same helper, so grade-lookup semantics stay identical across surfaces.
 *
 * `supabase` is the already-resolved service-role client (callers handle the
 * unconfigured case). `identity` is the resolved caller identity — from the
 * request body on the CLI routes, from the MCP initialize handshake on the
 * hosted endpoint.
 */
export interface LookupContext {
  supabase: SupabaseClient;
  identity: AgentIdentity;
}

/** A helper-level error carrying the HTTP status the CLI route should use.
 *  The MCP endpoint ignores `code` and surfaces `error` as an isError result. */
export interface LookupError {
  status: "error";
  code: number;
  error: string;
}
