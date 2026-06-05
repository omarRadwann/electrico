/**
 * Prefix a public asset path with the deploy base path.
 *
 * On GitHub Pages the site lives under a project subpath (e.g. /electrico), set via
 * NEXT_PUBLIC_BASE_PATH at build. Next applies `basePath` to routes + _next chunks
 * automatically, but NOT to raw string URLs we hand to loaders (useGLTF, useTexture,
 * <Environment files>), so those must be prefixed manually or they 404 under the
 * subpath. Locally the env is unset → returns the path unchanged.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function asset(path: string): string {
  return `${BASE_PATH}${path}`;
}
