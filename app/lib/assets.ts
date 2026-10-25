/**
 * Client-safe asset path resolver (safe to import in "use client" components).
 *
 * Files under `/images/...` live outside `public/` and are normally served by
 * the `/api/serve/...` route. When the storage backend is a bucket/CDN, set
 * `NEXT_PUBLIC_STORAGE_BASE_URL` (e.g. `https://cdn.example.com`) and the same
 * stored paths resolve straight to that origin — no code changes needed.
 */
const STORAGE_BASE_URL = (
  process.env.NEXT_PUBLIC_STORAGE_BASE_URL || ""
).replace(/\/+$/, "");

export function resolveAssetPath(
  path: string | null | undefined,
): string | null {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;

  if (path.startsWith("/images/")) {
    if (STORAGE_BASE_URL) return `${STORAGE_BASE_URL}${path}`;
    return path.replace(/^\/images\//, "/api/serve/");
  }

  if (path.startsWith("/")) return path;
  return `/${path}`;
}
