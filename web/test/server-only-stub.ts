// Vitest stub for the `server-only` marker package. In a Next.js build the real
// package throws if a server-only module is pulled into a client bundle; under
// vitest (plain Node) there is no such boundary, so we alias it to a no-op to let
// server-only lib modules be unit-tested directly. The runtime guard still holds
// during `next build`.
export {};
