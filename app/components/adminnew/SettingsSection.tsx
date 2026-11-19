"use client";

import { Clock, Image as ImageIcon, UploadCloud } from "lucide-react";
import Image from "next/image";
import type useGalleryConfig from "@/app/components/admin/hooks/useGalleryConfig";
import type { Folder } from "@/app/components/admin/types";
import { SectionHeader } from "./ui";

type GalleryConfigApi = ReturnType<typeof useGalleryConfig>;

export default function SettingsSection({
  folders,
  galleryConfig,
}: {
  folders: Folder[];
  galleryConfig: GalleryConfigApi;
}) {
  const {
    allThumbnailUrl,
    allThumbnailUploading,
    allThumbnailPreview,
    filterTargetId,
    filterMinutes,
    filterNoLimit,
    filterSaving,
    setFilterTargetId,
    setFilterMinutes,
    setFilterNoLimit,
    handleAllThumbnailSelect,
    uploadAllThumbnail,
    saveFolderAgeFilter,
  } = galleryConfig;

  const preview = allThumbnailPreview || allThumbnailUrl;

  return (
    <>
      <SectionHeader
        title="Settings"
        description="Manage the cover shown for the All gallery and how recent photos must be to appear there."
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="an-panel overflow-hidden">
          <div className="an-panel-head">
            <div>
              <h2 className="text-[13px] font-semibold">All folder cover</h2>
              <p className="mt-0.5 text-[11px] text-[var(--an-muted)]">
                Shown on the combined gallery tile in the site navigation.
              </p>
            </div>
          </div>

          <div className="an-panel-body space-y-4">
            <div className="relative aspect-[16/9] overflow-hidden rounded-lg border border-[var(--an-border)] bg-[var(--an-surface-2)]">
              {preview ? (
                <Image
                  src={preview}
                  alt="All folder cover preview"
                  fill
                  unoptimized
                  sizes="(max-width: 1280px) 100vw, 50vw"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-1.5 text-[var(--an-muted)]">
                  <ImageIcon size={22} />
                  <p className="text-[11px]">No cover set</p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label
                htmlFor="an-all-thumbnail"
                className="an-btn an-btn-soft cursor-pointer"
              >
                <UploadCloud size={14} />
                Choose image
              </label>
              <input
                id="an-all-thumbnail"
                type="file"
                accept="image/*"
                onChange={handleAllThumbnailSelect}
                className="sr-only"
              />
              <button
                type="button"
                className="an-btn an-btn-primary"
                onClick={() => void uploadAllThumbnail()}
                disabled={!allThumbnailPreview || allThumbnailUploading}
              >
                <UploadCloud size={14} />
                {allThumbnailUploading ? "Uploading…" : "Upload cover"}
              </button>
            </div>

            <p className="text-[11px] leading-relaxed text-[var(--an-muted)]">
              Pick a file, then upload it. The change applies to the live gallery
              immediately.
            </p>
          </div>
        </section>

        <section className="an-panel overflow-hidden">
          <div className="an-panel-head">
            <div>
              <h2 className="text-[13px] font-semibold">Gallery time filter</h2>
              <p className="mt-0.5 text-[11px] text-[var(--an-muted)]">
                Limit how old photos in the All gallery may be.
              </p>
            </div>
          </div>

          <div className="an-panel-body space-y-4">
            <div>
              <label className="an-label" htmlFor="an-filter-target">
                Folder
              </label>
              <select
                id="an-filter-target"
                value={filterTargetId}
                onChange={(e) => setFilterTargetId(e.target.value)}
                className="mt-1.5 w-full rounded-md border border-[var(--an-border)] bg-[var(--an-surface)] px-2.5 py-2 text-[12px] text-[var(--an-text)] outline-none focus:border-[var(--an-accent)]"
              >
                <option value="all">All folders</option>
                {folders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.name}
                  </option>
                ))}
              </select>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-[12px]">
              <input
                type="checkbox"
                checked={filterNoLimit}
                onChange={(e) => setFilterNoLimit(e.target.checked)}
                className="h-4 w-4 accent-[var(--an-accent)]"
              />
              No age limit
            </label>

            {!filterNoLimit && (
              <div>
                <label className="an-label" htmlFor="an-filter-minutes">
                  Maximum age (minutes)
                </label>
                <input
                  id="an-filter-minutes"
                  type="number"
                  min={1}
                  value={filterMinutes}
                  onChange={(e) => setFilterMinutes(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-md border border-[var(--an-border)] bg-[var(--an-surface)] px-2.5 py-2 text-[12px] text-[var(--an-text)] outline-none focus:border-[var(--an-accent)]"
                />
              </div>
            )}

            <div className="an-inset flex items-start gap-2 p-3">
              <Clock size={14} className="mt-0.5 shrink-0 text-[var(--an-muted)]" />
              <p className="text-[11px] leading-relaxed text-[var(--an-muted)]">
                Folders without a limit always show their full history. Saving
                applies only to the selected folder.
              </p>
            </div>

            <button
              type="button"
              className="an-btn an-btn-primary"
              onClick={() => void saveFolderAgeFilter()}
              disabled={filterSaving}
            >
              <Clock size={14} />
              {filterSaving ? "Saving…" : "Save time filter"}
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
