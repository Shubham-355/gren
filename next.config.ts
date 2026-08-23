import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so a stray lockfile in a parent directory does not
  // get picked up as the project root.
  turbopack: {
    root: path.resolve(import.meta.dirname ?? "."),
  },
};

export default nextConfig;
