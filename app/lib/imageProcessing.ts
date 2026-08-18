import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/**
 * Shared image-processing pipeline for uploaded thumbnails.
 *
 * Both the per-folder thumbnail upload and the "All folders" thumbnail upload
 * generate the same three variants (original / webp / 300x300 thumb) and were
 * previously copy-pasting ~80 lines of sharp code. This helper keeps the two
 * routes in sync.
 */

/** Thumbnail variant path used for videos that have no extracted frame. */
export const VIDEO_PLACEHOLDER_PATH = "/icons/video-placeholder.svg";

/** Build a DB variant path like `/images/{folderId}/webp/file.webp`. */
export const dbVariantPath = (
  folderId: string,
  subdir: string,
  fileName: string,
) => `/images/${folderId}/${subdir}/${fileName}`;

export interface ProcessedImageResult {
  original: { dbPath: string; size: number };
  webp: { dbPath: string; size: number };
  thumbnail: { dbPath: string; size: number };
  width: number | null;
  height: number | null;
}

export interface ProcessImageOptions {
  /** Raw bytes of the uploaded image. */
  buffer: Buffer;
  /** File name the original is stored under (base name derives webp/thumb names). */
  originalFileName: string;
  /** Absolute directory holding `original/`, `webp/`, `thumbs/` sub-directories. */
  baseDir: string;
  /** Folder id (or `_all`) used to build the `/images/...` DB paths. */
  dbFolder: string;
  /** Override the base name for webp/thumb files (used to guarantee uniqueness). */
  baseName?: string;
  /** Embed `orientation: 1` in the variant metadata (pixels are already normalized by `.rotate()`). */
  embedOrientationMeta?: boolean;
}

/**
 * Writes the original file and generates webp + 300x300 thumbnail variants.
 * Returns DB-relative paths and byte sizes ready to be stored in the DB.
 */
export async function processImageUpload({
  buffer,
  originalFileName,
  baseDir,
  dbFolder,
  baseName,
  embedOrientationMeta = false,
}: ProcessImageOptions): Promise<ProcessedImageResult> {
  const extension = path.extname(originalFileName);
  const fileBaseName = baseName ?? path.basename(originalFileName, extension);
  const webpFileName = `${fileBaseName}.webp`;
  const thumbFileName = `${fileBaseName}_thumb.webp`;

  const originalDir = path.join(baseDir, "original");
  const webpDir = path.join(baseDir, "webp");
  const thumbDir = path.join(baseDir, "thumbs");
  await Promise.all([
    mkdir(originalDir, { recursive: true }),
    mkdir(webpDir, { recursive: true }),
    mkdir(thumbDir, { recursive: true }),
  ]);

  const originalPath = path.join(originalDir, originalFileName);
  const webpPath = path.join(webpDir, webpFileName);
  const thumbPath = path.join(thumbDir, thumbFileName);

  await writeFile(originalPath, buffer);

  const rotated = sharp(buffer, { failOnError: false }).rotate();
  const { width, height } = await rotated.metadata();

  const variant = embedOrientationMeta
    ? rotated.withMetadata({ orientation: 1 })
    : rotated;

  await variant.clone().webp({ quality: 85, effort: 6 }).toFile(webpPath);
  await variant
    .clone()
    .resize(300, 300, {
      fit: "cover",
      position: "center",
      withoutEnlargement: false,
    })
    .webp({ quality: 80, effort: 6 })
    .toFile(thumbPath);

  const [originalStats, webpStats, thumbStats] = await Promise.all([
    stat(originalPath),
    stat(webpPath),
    stat(thumbPath),
  ]);

  return {
    original: {
      dbPath: dbVariantPath(dbFolder, "original", originalFileName),
      size: originalStats.size,
    },
    webp: {
      dbPath: dbVariantPath(dbFolder, "webp", webpFileName),
      size: webpStats.size,
    },
    thumbnail: {
      dbPath: dbVariantPath(dbFolder, "thumbs", thumbFileName),
      size: thumbStats.size,
    },
    width: width ?? null,
    height: height ?? null,
  };
}
