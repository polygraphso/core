import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: { environment: "node" },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
      // `server-only` throws under plain-Node vitest; stub it so server-only
      // lib modules can be unit-tested. The real guard still applies at build.
      "server-only": resolve(__dirname, "test/server-only-stub.ts"),
    },
  },
});
