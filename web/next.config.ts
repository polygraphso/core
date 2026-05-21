import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pnpm monorepo: tell Next's file tracer that the workspace root is one
  // level up so it follows symlinks into packages/scoring + packages/core
  // when bundling /api/admin/* serverless functions.
  outputFileTracingRoot: path.join(__dirname, ".."),
};

export default nextConfig;
