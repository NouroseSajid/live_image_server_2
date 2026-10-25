import path from "node:path";
import sharp from "sharp";
import { getStorage, storageKey } from "./storage";

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
  dbFolder,
  baseName,
  embedOrientationMeta = false,
}: ProcessImageOptions): Promise<ProcessedImageResult> {
  const extension = path.extname(originalFileName);
  const fileBaseName = baseName ?? path.basename(originalFileName, extension);
  const webpFileName = `${fileBaseName}.webp`;
  const thumbFileName = `${fileBaseName}_thumb.webp`;

  const originalKey = storageKey(
    "images",
    dbFolder,
    "original",
    originalFileName,
  );
  const webpKey = storageKey("images", dbFolder, "webp", webpFileName);
  const thumbKey = storageKey("images", dbFolder, "thumbs", thumbFileName);

  const storage = getStorage();
  await storage.write(originalKey, buffer);

  const rotated = sharp(buffer, { failOnError: false }).rotate();
  const { width, height } = await rotated.metadata();

  const variant = embedOrientationMeta
    ? rotated.withMetadata({ orientation: 1 })
    : rotated;

  const webpBuffer = await variant
    .clone()
    .webp({ quality: 85, effort: 6 })
    .toBuffer();

  const thumbBuffer = await variant
    .clone()
    .resize(300, 300, {
      fit: "cover",
      position: "center",
      withoutEnlargement: false,
    })
    .webp({ quality: 80, effort: 6 })
    .toBuffer();

  await storage.write(webpKey, webpBuffer);
  await storage.write(thumbKey, thumbBuffer);

  return {
    original: {
      dbPath: dbVariantPath(dbFolder, "original", originalFileName),
      size: buffer.length,
    },
    webp: {
      dbPath: dbVariantPath(dbFolder, "webp", webpFileName),
      size: webpBuffer.length,
    },
    thumbnail: {
      dbPath: dbVariantPath(dbFolder, "thumbs", thumbFileName),
      size: thumbBuffer.length,
    },
    width: width ?? null,
    height: height ?? null,
  };
}
