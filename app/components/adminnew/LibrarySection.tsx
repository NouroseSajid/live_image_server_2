"use client";

import {
  Check,
  Download,
  Eye,
  FileVideo,
  FolderPlus,
  Image as ImageIcon,
  Upload,
  UploadCloud,
  X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef } from "react";
import { formatFileSize, getPreviewPath } from "@/app/components/admin/fileUtils";
import type useAdminFiles from "@/app/components/admin/hooks/useAdminFiles";
import type { FileEntry, Folder } from "@/app/components/admin/types";
import { EmptyState, SectionHeader } from "./ui";

type FilesApi = ReturnType<typeof useAdminFiles>;

function FileCard({
  file,
  selected,
  onToggle,
  onSetCover,
}: {
  file: FileEntry;
  selected: boolean;
  onToggle: () => void;
  onSetCover: (fileId: string) => void;
}) {
  const preview = getPreviewPath(file);

  return (
    <div className="an-media-card group" data-selected={selected}>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={selected}
        aria-label={selected ? `Deselect ${file.fileName}` : `Select ${file.fileName}`}
        className={`absolute left-2 top-2 z-20 flex h-5 w-5 items-center justify-center rounded border transition-colors ${
          selected
            ? "border-[var(--an-accent)] bg-[var(--an-accent)] text-[var(--an-accent-contrast)]"
            : "border-white/70 bg-black/35 text-transparent hover:bg-black/55"
        }`}
      >
        <Check size={12} strokeWidth={3} />
      </button>

      <div className="relative aspect-square bg-[var(--an-surface-2)]">
        <button
          type="button"
          onClick={onToggle}
          aria-label={`Select ${file.fileName}`}
          className="absolute inset-0"
        >
          {preview ? (
            <Image
              src={preview}
              alt={file.fileName}
              fill
              unoptimized
              sizes="(max-width: 640px) 50vw, (max-width: 1280px) 25vw, 18vw"
              className="object-cover"
            />
          ) : (
            <span className="flex h-full items-center justify-center text-[var(--an-muted)]">
              <FileVideo size={24} />
            </span>
          )}
        </button>

        <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-end gap-1 bg-black/45 p-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          {file.fileType === "image" && (
            <button
              type="button"
              onClick={() => onSetCover(file.id)}
              title="Use as folder cover"
              aria-label="Use as folder cover"
              className="flex h-6 w-6 items-center justify-center rounded text-white/90 hover:bg-white/15 hover:text-white"
            >
              <ImageIcon size={13} />
            </button>
          )}
          <a
            href={`/api/images/${file.id}/download`}
            title="Download file"
            aria-label="Download file"
            className="flex h-6 w-6 items-center justify-center rounded text-white/90 hover:bg-white/15 hover:text-white"
          >
            <Download size={13} />
          </a>
        </div>
      </div>

      <div className="p-2.5">
        <p className="truncate text-[12px] font-medium" title={file.fileName}>
          {file.fileName}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-[var(--an-muted)]">
          <span>{formatFileSize(file.fileSize)}</span>
          <span>·</span>
          <span className="uppercase">{file.fileType}</span>
          {file.pendingRequests > 0 && (
            <span className="text-[var(--an-warning)]">
              {file.pendingRequests} request
              {file.pendingRequests === 1 ? "" : "s"}
            </span>
          )}
        </p>
        <p className="mt-1 flex items-center gap-3 text-[11px] text-[var(--an-muted)]">
          <span className="inline-flex items-center gap-1">
            <Eye size={12} aria-hidden />
            {(file.viewCount ?? 0).toLocaleString()} view
            {file.viewCount === 1 ? "" : "s"}
          </span>
          <span className="inline-flex items-center gap-1">
            <Download size={12} aria-hidden />
            {(file.downloadCount ?? 0).toLocaleString()} download
            {file.downloadCount === 1 ? "" : "s"}
          </span>
        </p>
      </div>
    </div>
  );
}

function StagedRow({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const previewUrl = useMemo(
    () => (file.type.startsWith("image/") ? URL.createObjectURL(file) : null),
    [file],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <li className="flex items-center gap-3 rounded-md border border-[var(--an-border)] bg-[var(--an-surface-2)] p-2">
      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded border border-[var(--an-border)] bg-[var(--an-surface)]">
        {previewUrl ? (
          <Image
            src={previewUrl}
            alt=""
            fill
            unoptimized
            sizes="40px"
            className="object-cover"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-[var(--an-muted)]">
            <FileVideo size={16} />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-medium">
          {file.name}
        </span>
        <span className="block text-[11px] text-[var(--an-muted)]">
          {formatFileSize(String(file.size))}
        </span>
      </span>
      <button
        type="button"
        className="an-icon-btn an-icon-btn-danger"
        onClick={onRemove}
        aria-label={`Remove ${file.name}`}
      >
        <X size={14} />
      </button>
    </li>
  );
}

export default function LibrarySection({
  folders,
  activeFolder,
  onSelectFolder,
  filesApi,
  onSetFolderThumbnail,
  onCreateFolder,
}: {
  folders: Folder[];
  activeFolder: Folder | null;
  onSelectFolder: (folderId: string | null) => void;
  filesApi: FilesApi;
  onSetFolderThumbnail: (fileId: string) => void;
  onCreateFolder: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    files,
    dragActive,
    dragRef,
    handleDrag,
    handleDrop,
    uploadImage,
    stagedFiles,
    confirmStagedUpload,
    cancelStagedUpload,
    removeStagedFile,
    selectedIds,
    actionTargetFolderId,
    setActionTargetFolderId,
    isBulkWorking,
    conflictInfo,
    toggleSelect,
    clearSelection,
    selectAll,
    applyBulkAction,
    resolveConflicts,
  } = filesApi;

  const totals = useMemo(
    () =>
      files.reduce(
        (acc, file) => ({
          views: acc.views + (file.viewCount ?? 0),
          downloads: acc.downloads + (file.downloadCount ?? 0),
        }),
        { views: 0, downloads: 0 },
      ),
    [files],
  );

  return (
    <>
      <SectionHeader
        title="Library"
        description="Upload files, review metadata, and run bulk actions inside a folder."
        actions={
          <button
            type="button"
            className="an-btn an-btn-soft"
            onClick={onCreateFolder}
          >
            <FolderPlus size={14} />
            New folder
          </button>
        }
      />

      <section className="an-panel overflow-hidden">
        <div className="an-panel-head items-center">
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold">Files</h2>
            <p className="mt-0.5 truncate text-[11px] text-[var(--an-muted)]">
              {activeFolder
                ? `${activeFolder.name} · ${files.length} file${files.length === 1 ? "" : "s"}`
                : "Choose a folder to begin."}
            </p>
            {activeFolder && files.length > 0 && (
              <p className="mt-1 flex items-center gap-3 text-[11px] text-[var(--an-muted)]">
                <span className="inline-flex items-center gap-1">
                  <Eye size={12} aria-hidden />
                  {totals.views.toLocaleString()} views
                </span>
                <span className="inline-flex items-center gap-1">
                  <Download size={12} aria-hidden />
                  {totals.downloads.toLocaleString()} downloads
                </span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              className="an-select w-[210px]"
              value={activeFolder?.id ?? ""}
              onChange={(event) =>
                onSelectFolder(event.target.value || null)
              }
              aria-label="Select folder"
            >
              <option value="">Select a folder…</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="an-btn an-btn-primary"
              onClick={() => fileInputRef.current?.click()}
              disabled={!activeFolder}
            >
              <Upload size={14} />
              Upload
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              className="hidden"
              onChange={uploadImage}
            />
          </div>
        </div>

        <div className="an-panel-body space-y-3">
          {!activeFolder ? (
            <EmptyState
              icon={<UploadCloud size={22} />}
              title="No folder selected"
              description="Pick a folder above to view files and upload new media."
              action={
                <button
                  type="button"
                  className="an-btn an-btn-primary an-btn-xs"
                  onClick={onCreateFolder}
                >
                  <FolderPlus size={13} />
                  New folder
                </button>
              }
            />
          ) : (
            <>
              <div
                ref={dragRef}
                className="an-dropzone flex flex-col items-center justify-center px-6 py-8 text-center"
                data-active={dragActive}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                <UploadCloud
                  size={22}
                  className="text-[var(--an-muted)]"
                  aria-hidden
                />
                <p className="mt-2 text-[13px] font-medium">
                  Drop files here
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--an-muted)]">
                  or click to choose images and videos from your computer
                </p>
              </div>

              {selectedIds.size > 0 && (
                <div className="an-inset flex flex-wrap items-center gap-2 p-2">
                  <span className="text-[12px] font-medium">
                    {selectedIds.size} selected
                  </span>
                  <button
                    type="button"
                    className="an-btn an-btn-ghost an-btn-xs"
                    onClick={clearSelection}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    className="an-btn an-btn-ghost an-btn-xs"
                    onClick={() => selectAll()}
                  >
                    Select all
                  </button>

                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <select
                      className="an-select w-[190px]"
                      value={actionTargetFolderId ?? ""}
                      onChange={(event) =>
                        setActionTargetFolderId(event.target.value || null)
                      }
                      aria-label="Target folder"
                    >
                      <option value="">Move or copy to…</option>
                      {folders
                        .filter((folder) => folder.id !== activeFolder.id)
                        .map((folder) => (
                          <option key={folder.id} value={folder.id}>
                            {folder.name}
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      className="an-btn an-btn-soft an-btn-xs"
                      onClick={() => void applyBulkAction("move")}
                      disabled={!actionTargetFolderId || isBulkWorking}
                    >
                      Move
                    </button>
                    <button
                      type="button"
                      className="an-btn an-btn-soft an-btn-xs"
                      onClick={() => void applyBulkAction("copy")}
                      disabled={!actionTargetFolderId || isBulkWorking}
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      className="an-btn an-btn-danger an-btn-xs"
                      onClick={() => void applyBulkAction("delete")}
                      disabled={isBulkWorking}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}

              {files.length === 0 ? (
                <EmptyState
                  icon={<ImageIcon size={22} />}
                  title="This folder is empty"
                  description="Drop files above or use the upload button to add media."
                />
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {files.map((file) => (
                    <FileCard
                      key={file.id}
                      file={file}
                      selected={selectedIds.has(file.id)}
                      onToggle={() => toggleSelect(file.id)}
                      onSetCover={onSetFolderThumbnail}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>

      {stagedFiles.length > 0 && (
        <div
          className="an-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="upload-drawer-title"
        >
          <div className="an-drawer">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--an-border)] px-5 py-4">
              <div>
                <h2
                  id="upload-drawer-title"
                  className="text-[15px] font-semibold"
                >
                  Add files to the upload queue
                </h2>
                <p className="mt-0.5 text-[12px] text-[var(--an-muted)]">
                  {stagedFiles.length} file
                  {stagedFiles.length === 1 ? "" : "s"} for{" "}
                  {activeFolder?.name}
                </p>
              </div>
              <button
                type="button"
                className="an-icon-btn"
                onClick={cancelStagedUpload}
                aria-label="Close upload preview"
              >
                <X size={16} />
              </button>
            </div>

            <div className="an-scroll flex-1 overflow-y-auto p-4">
              <ul className="space-y-2">
                {stagedFiles.map((file, index) => (
                  <StagedRow
                    key={`${file.name}-${file.size}-${file.lastModified}`}
                    file={file}
                    onRemove={() => removeStagedFile(index)}
                  />
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--an-border)] px-5 py-4">
              <button
                type="button"
                className="an-btn an-btn-soft"
                onClick={cancelStagedUpload}
              >
                Cancel
              </button>
              <button
                type="button"
                className="an-btn an-btn-primary"
                onClick={confirmStagedUpload}
              >
                <Upload size={14} />
                Add to queue
              </button>
            </div>
          </div>
        </div>
      )}

      {conflictInfo && (
        <div
          className="fixed inset-0 z-[1250] flex items-center justify-center bg-black/35 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="conflict-title"
        >
          <div className="an-panel w-full max-w-md overflow-hidden">
            <div className="an-panel-head">
              <div>
                <h2 id="conflict-title" className="text-[14px] font-semibold">
                  File name conflicts
                </h2>
                <p className="mt-0.5 text-[11px] text-[var(--an-muted)]">
                  {conflictInfo.conflicts.length} file
                  {conflictInfo.conflicts.length === 1 ? "" : "s"} already
                  exist in the target folder.
                </p>
              </div>
            </div>

            <div className="an-panel-body space-y-3">
              <ul className="an-inset an-scroll max-h-40 overflow-y-auto">
                {conflictInfo.conflicts.map((conflict) => (
                  <li
                    key={conflict.fileId}
                    className="border-b border-[var(--an-border)] px-3 py-2 text-[12px] last:border-b-0"
                  >
                    <span className="block truncate">
                      {conflict.fileName}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-[var(--an-muted)]">
                Choose how to resolve the conflicts before continuing.
              </p>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--an-border)] px-4 py-3">
              <button
                type="button"
                className="an-btn an-btn-soft an-btn-xs"
                onClick={() => resolveConflicts("skip")}
                disabled={isBulkWorking}
              >
                Skip
              </button>
              <button
                type="button"
                className="an-btn an-btn-soft an-btn-xs"
                onClick={() => resolveConflicts("rename")}
                disabled={isBulkWorking}
              >
                Rename
              </button>
              <button
                type="button"
                className="an-btn an-btn-primary an-btn-xs"
                onClick={() => resolveConflicts("replace")}
                disabled={isBulkWorking}
              >
                Replace
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
