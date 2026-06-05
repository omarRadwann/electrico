import type { NextConfig } from "next";

// Deploy base path for GitHub Pages project sites (served under /<repo>). Set via
// NEXT_PUBLIC_BASE_PATH in the Pages workflow (e.g. "/electrico"); unset locally so
// `npm run dev` serves from the root. Must match src/lib/asset.ts.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  // Static HTML export — GitHub Pages serves plain files, no Node server. Produces
  // ./out at build (`next build`). The dive is a fully client-side WebGL app, so a
  // static export loses nothing.
  output: "export",
  basePath,
  // Pages has no Next Image optimizer; serve images as-authored.
  images: { unoptimized: true },
  // Emit each route as <route>/index.html so paths resolve without a rewrite layer.
  trailingSlash: true,
  // Pin Turbopack's workspace root to this project. A stray pnpm-lock.yaml in
  // the user's home directory was being auto-selected as the root, which can
  // mis-resolve modules/assets. __dirname is the directory of this config file.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
