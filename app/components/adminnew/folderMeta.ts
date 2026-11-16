import { resolveAssetPath } from "@/app/lib/assets";
import type { Folder } from "@/app/components/admin/types";

export type BadgeTone =
  | "neutral"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "outline";

export function getFolderVisibility(folder: Folder): {
  label: string;
  tone: BadgeTone;
} {
  if (folder.archived) return { label: "Archived", tone: "neutral" };
  if (!folder.visible) return { label: "Hidden", tone: "warning" };
  if (folder.inGridView) return { label: "In gallery", tone: "success" };
  return { label: "Visible", tone: "outline" };
}

export function getFolderCover(folder: Folder): string | null {
  return resolveAssetPath(folder.folderThumb);
}

export function getSharePath(folder: Folder): string {
  return `/f/${folder.uniqueUrl}`;
}

export function getUnlockedPath(folder: Folder): string {
  const base = getSharePath(folder);
  if (!folder.isPrivate || !folder.passphrase) return base;
  return `${base}+?p=${encodeURIComponent(folder.passphrase)}`;
}
