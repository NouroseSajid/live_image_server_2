/**
 * Client-side asset path resolver (safe to import in "use client" components).
 *
 * Files under `/images/...` live outside `public/` and are only reachable
 * through the `/api/serve/...` route, so any stored path pointing at the image
 * repo must be rewritten before it can be loaded by the browser.
 */
export function resolveAssetPath(
  path: string | null | undefined,
): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith("/images/")) {
    return path.replace(/^\/images\//, "/api/serve/");
  }
  if (path.startsWith("/")) return path;
  return `/${path}`;
}
