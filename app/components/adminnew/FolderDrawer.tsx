"use client";

import {
  Archive,
  Eye,
  Images,
  LayoutGrid,
  Link2,
  Lock,
  Upload,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Folder, FolderGroup } from "@/app/components/admin/types";
import { getFolderCover } from "./folderMeta";
import type { FolderDraft } from "./types";

type VisibilityKey = "archived" | "hidden" | "visible" | "gallery";

const VISIBILITY_OPTIONS: Array<{
  key: VisibilityKey;
  label: string;
  description: string;
  icon: React.ReactNode;
}> = [
  {
    key: "archived",
    label: "Archived",
    description: "Admin only. Removed from public navigation.",
    icon: <Archive size={14} />,
  },
  {
    key: "hidden",
    label: "Hidden",
    description: "Reachable by direct link only.",
    icon: <Link2 size={14} />,
  },
  {
    key: "visible",
    label: "Visible",
    description: "Listed in the folder navigation.",
    icon: <Eye size={14} />,
  },
  {
    key: "gallery",
    label: "In gallery",
    description: "Images also appear in the main gallery.",
    icon: <LayoutGrid size={14} />,
  },
];

function deriveVisibility(folder: Folder | null): VisibilityKey {
  if (!folder) return "visible";
  if (folder.archived) return "archived";
  if (!folder.visible) return "hidden";
  if (folder.inGridView) return "gallery";
  return "visible";
}

export default function FolderDrawer({
  mode,
  open,
  folder,
  groups,
  onClose,
  onCreate,
  onUpdate,
  onUploadThumbnail,
}: {
  mode: "create" | "edit";
  open: boolean;
  folder: Folder | null;
  groups: FolderGroup[];
  onClose: () => void;
  onCreate: (draft: FolderDraft) => Promise<void>;
  onUpdate: (draft: FolderDraft) => Promise<void>;
  onUploadThumbnail: (folderId: string, file: File) => Promise<void>;
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(folder?.name ?? "");
  const [slug, setSlug] = useState(folder?.uniqueUrl ?? "");
  const [groupId, setGroupId] = useState(folder?.groupId ?? "");
  const [visibility, setVisibility] = useState<VisibilityKey>(
    deriveVisibility(folder),
  );
  const [isPrivate, setIsPrivate] = useState(folder?.isPrivate ?? false);
  const [passphrase, setPassphrase] = useState(folder?.passphrase ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [thumbnailUploading, setThumbnailUploading] = useState(false);

  useEffect(() => {
    if (open) closeButtonRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving && !thumbnailUploading) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, saving, thumbnailUploading, onClose]);

  if (!open) return null;

  const currentCover = folder ? getFolderCover(folder) : null;
  const coverPreview = thumbnailPreview ?? currentCover;

  const handleThumbnailSelect = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setThumbnailFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setThumbnailPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleThumbnailUpload = async () => {
    if (!folder || !thumbnailFile) return;

    setThumbnailUploading(true);
    setError(null);
    try {
      await onUploadThumbnail(folder.id, thumbnailFile);
      setThumbnailFile(null);
      setThumbnailPreview(null);
      if (thumbnailInputRef.current) thumbnailInputRef.current.value = "";
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to upload folder cover",
      );
    } finally {
      setThumbnailUploading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Folder name is required.");
      return;
    }

    const trimmedSlug = slug.trim();
    if (trimmedSlug && !/^[a-zA-Z0-9_-]+$/.test(trimmedSlug)) {
      setError(
        "URL slug can only contain letters, numbers, hyphens, and underscores.",
      );
      return;
    }

    if (isPrivate && !passphrase.trim()) {
      setError("A passphrase is required when password protection is enabled.");
      return;
    }

    const visibilityMap: Record<
      VisibilityKey,
      Pick<FolderDraft, "archived" | "visible" | "inGridView">
    > = {
      archived: { archived: true, visible: false, inGridView: false },
      hidden: { archived: false, visible: false, inGridView: false },
      visible: { archived: false, visible: true, inGridView: false },
      gallery: { archived: false, visible: true, inGridView: true },
    };

    const draft: FolderDraft = {
      name: name.trim(),
      isPrivate,
      passphrase: isPrivate ? passphrase.trim() : null,
      groupId: groupId || null,
      ...visibilityMap[visibility],
      ...(trimmedSlug ? { uniqueUrl: trimmedSlug } : {}),
    };

    setSaving(true);
    try {
      if (mode === "create") {
        await onCreate(draft);
      } else {
        await onUpdate(draft);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save folder");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="an-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="folder-drawer-title"
    >
      <div className="an-drawer">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--an-border)] px-5 py-4">
          <div className="min-w-0">
            <h2 id="folder-drawer-title" className="text-[15px] font-semibold">
              {mode === "create" ? "New folder" : "Edit folder"}
            </h2>
            <p className="mt-0.5 truncate text-[12px] text-[var(--an-muted)]">
              {mode === "create"
                ? "Create a folder and choose how it is exposed."
                : folder?.name}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="an-icon-btn"
            onClick={onClose}
            disabled={saving || thumbnailUploading}
            aria-label="Close folder editor"
          >
            <X size={16} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="an-scroll flex-1 space-y-5 overflow-y-auto px-5 py-5">
            {error && (
              <div className="rounded-md border border-[var(--an-danger)] bg-[var(--an-danger-soft)] px-3 py-2 text-[12px] leading-relaxed text-[var(--an-danger)]">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="folder-name"
                className="block text-[12px] font-medium"
              >
                Name
              </label>
              <input
                id="folder-name"
                className="an-input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Summer 2026"
                autoComplete="off"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="folder-slug"
                className="block text-[12px] font-medium"
              >
                URL slug
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] text-[var(--an-muted)]">/f/</span>
                <input
                  id="folder-slug"
                  className="an-input"
                  value={slug}
                  onChange={(event) => setSlug(event.target.value)}
                  placeholder={
                    mode === "create" ? "generated-from-name" : "folder-slug"
                  }
                  autoComplete="off"
                />
              </div>
              <p className="text-[11px] leading-relaxed text-[var(--an-muted)]">
                Letters, numbers, hyphens, and underscores only.
                {mode === "create" && " Leave blank to generate it from the name."}
              </p>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="folder-group"
                className="block text-[12px] font-medium"
              >
                Group
              </label>
              <select
                id="folder-group"
                className="an-select"
                value={groupId}
                onChange={(event) => setGroupId(event.target.value)}
              >
                <option value="">No group</option>
                {groups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
              <p className="text-[11px] leading-relaxed text-[var(--an-muted)]">
                Groups organize folders in the public navigation.
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-[12px] font-medium">Visibility</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {VISIBILITY_OPTIONS.map((option) => (
                  <label
                    key={option.key}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-md border p-3 transition-colors ${
                      visibility === option.key
                        ? "border-[var(--an-accent)] bg-[var(--an-accent-soft)]"
                        : "border-[var(--an-border)] hover:bg-[var(--an-surface-2)]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="visibility"
                      value={option.key}
                      checked={visibility === option.key}
                      onChange={() => setVisibility(option.key)}
                      className="mt-0.5 h-3.5 w-3.5 accent-[var(--an-accent)]"
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-[12px] font-medium">
                        <span className="text-[var(--an-muted)]">
                          {option.icon}
                        </span>
                        {option.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-relaxed text-[var(--an-muted)]">
                        {option.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[12px] font-medium">Security</p>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-[var(--an-border)] p-3">
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setIsPrivate(checked);
                    if (!checked) setPassphrase("");
                  }}
                  className="mt-0.5 h-4 w-4 accent-[var(--an-accent)]"
                />
                <span>
                  <span className="flex items-center gap-1.5 text-[12px] font-medium">
                    <Lock size={13} className="text-[var(--an-muted)]" />
                    Password protection
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-[var(--an-muted)]">
                    Require a passphrase before the folder can be viewed.
                  </span>
                </span>
              </label>

              {isPrivate && (
                <input
                  className="an-input"
                  type="text"
                  value={passphrase}
                  onChange={(event) => setPassphrase(event.target.value)}
                  placeholder="Passphrase"
                  autoComplete="off"
                />
              )}
            </div>

            {mode === "edit" && folder && (
              <div className="space-y-2">
                <p className="text-[12px] font-medium">Cover image</p>
                <div className="flex items-center gap-3">
                  <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-md border border-[var(--an-border)] bg-[var(--an-surface-2)]">
                    {coverPreview ? (
                      <Image
                        src={coverPreview}
                        alt=""
                        fill
                        unoptimized
                        sizes="96px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center text-[var(--an-muted)]">
                        <Images size={18} />
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col items-start gap-1.5">
                    <button
                      type="button"
                      className="an-btn an-btn-soft an-btn-xs"
                      onClick={() => thumbnailInputRef.current?.click()}
                      disabled={thumbnailUploading}
                    >
                      Choose image
                    </button>
                    {thumbnailFile && (
                      <button
                        type="button"
                        className="an-btn an-btn-primary an-btn-xs"
                        onClick={() => void handleThumbnailUpload()}
                        disabled={thumbnailUploading}
                      >
                        <Upload size={12} />
                        {thumbnailUploading ? "Uploading…" : "Upload cover"}
                      </button>
                    )}
                  </div>
                </div>
                <input
                  ref={thumbnailInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleThumbnailSelect}
                />
                <p className="text-[11px] leading-relaxed text-[var(--an-muted)]">
                  Processed with the same image variants as regular uploads.
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-[var(--an-border)] px-5 py-4">
            <button
              type="button"
              className="an-btn an-btn-soft"
              onClick={onClose}
              disabled={saving || thumbnailUploading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="an-btn an-btn-primary"
              disabled={saving || thumbnailUploading}
            >
              {saving
                ? "Saving…"
                : mode === "create"
                  ? "Create folder"
                  : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
