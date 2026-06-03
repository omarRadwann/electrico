import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin Turbopack's workspace root to this project. A stray pnpm-lock.yaml in
  // the user's home directory was being auto-selected as the root, which can
  // mis-resolve modules/assets. __dirname is the directory of this config file.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
