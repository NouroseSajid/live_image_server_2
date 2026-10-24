import { resolveAssetPath } from "../../lib/assets";
import type { FileEntry } from "./types";

export const formatFileSize = (bytes: string) => {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(size) / Math.log(k));
  return `${Math.round((size / k ** i) * 100) / 100} ${sizes[i]}`;
};

type PreviewVariant = { name: string; path: string };

export const getPreviewFromVariants = (variants: PreviewVariant[]) => {
  const thumb = variants.find((variant) => variant.name === "thumbnail")?.path;
  const webp = variants.find((variant) => variant.name === "webp")?.path;
  const original = variants.find(
    (variant) => variant.name === "original",
  )?.path;
  return resolveAssetPath(thumb || webp || original) ?? "";
};

export const getPreviewPath = (file: FileEntry) =>
  getPreviewFromVariants(file.variants);
