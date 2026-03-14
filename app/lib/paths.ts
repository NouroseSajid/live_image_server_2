import { join } from "node:path";

/** Root directory for all image storage (outside public/ to prevent direct static access) */
export const IMAGE_REPO_ROOT = join(process.cwd(), "image_repo");
export const IMAGES_DIR = join(IMAGE_REPO_ROOT, "images");
export const INGEST_DIR = join(IMAGE_REPO_ROOT, "ingest");

/** Convert a DB variant path like `/images/folderId/webp/file.webp` to an absolute disk path */
export const dbPathToAbsolute = (dbPath: string) =>
  join(IMAGE_REPO_ROOT, dbPath.replace(/^\/+/, ""));
