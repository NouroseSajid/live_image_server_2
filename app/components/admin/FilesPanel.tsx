import Image from "next/image";
import { useMemo, useRef, useState } from "react";
import { FiCopy, FiImage, FiMove, FiTrash2 } from "react-icons/fi";
import { formatFileSize, getPreviewPath } from "./fileUtils";
import type { ConflictInfo, FileEntry, Folder } from "./types";

interface FilesPanelProps {
  activeFolder: string | null;
  folders: Folder[];
  files: FileEntry[];
  dragActive: boolean;
  dragRef: React.RefObject<HTMLDivElement | null>;
  onDragEnter: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  onUploadImage: (event: React.ChangeEvent<HTMLInputElement>) => void;
  selectedIds: Set<string>;
  actionTargetFolderId: string | null;
  onActionTargetFolderIdChange: (value: string | null) => void;
  onSelectAll: (ids?: string[]) => void;
  onClearSelection: () => void;
  onApplyBulkAction: (
    action: "move" | "copy" | "delete",
    conflictResolution?: "rename" | "replace" | "skip",
    overrideTargetFolderId?: string,
  ) => void;
  conflictInfo: ConflictInfo | null;
  onResolveConflicts: (resolution: "rename" | "replace" | "skip") => void;
  onToggleSelect: (id: string) => void;
  onSetFolderThumbnail: (fileId: string) => void;
  isBulkWorking: boolean;
  loading: boolean;
}

type SortBy = "name" | "newest" | "views" | "downloads";
type FilterBy = "all" | "viewed" | "downloaded" | "requested";

const fileNameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

export default function FilesPanel({
  activeFolder,
  folders,
  files,
  dragActive,
  dragRef,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onUploadImage,
  selectedIds,
  actionTargetFolderId,
  onActionTargetFolderIdChange,
  onSelectAll,
  onClearSelection,
  onApplyBulkAction,
  conflictInfo,
  onResolveConflicts,
  onToggleSelect,
  onSetFolderThumbnail,
  isBulkWorking,
  loading,
}: FilesPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [filterBy, setFilterBy] = useState<FilterBy>("all");

  const visibleFiles = useMemo(() => {
    const filtered = files.filter((file) => {
      switch (filterBy) {
        case "viewed":
          return file.viewCount > 0;
        case "downloaded":
          return file.downloadCount > 0;
        case "requested":
          return file.pendingRequests > 0;
        default:
          return true;
      }
    });

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
        case "views":
          return (
            b.viewCount - a.viewCount ||
            fileNameCollator.compare(a.fileName, b.fileName)
          );
        case "downloads":
          return (
            b.downloadCount - a.downloadCount ||
            fileNameCollator.compare(a.fileName, b.fileName)
          );
        default:
          return fileNameCollator.compare(a.fileName, b.fileName);
      }
    });

    return sorted;
  }, [files, filterBy, sortBy]);

  const totals = useMemo(
    () =>
      files.reduce(
        (acc, file) => ({
          views: acc.views + file.viewCount,
          downloads: acc.downloads + file.downloadCount,
        }),
        { views: 0, downloads: 0 },
      ),
    [files],
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <div className="flex items-center mb-6">
        <FiImage className="mr-2 text-purple-500" size={24} />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {activeFolder
            ? `Images - ${folders.find((f) => f.id === activeFolder)?.name}`
            : "Select a folder"}
        </h2>
      </div>

      {activeFolder ? (
        <>
          <div className="mb-6">
            <div ref={dragRef}>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,video/*,.arw,.cr2,.cr3,.nef,.orf,.raf,.rw2,.pef,.dng"
                onChange={onUploadImage}
                className="sr-only"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={onDragEnter}
                onDragLeave={onDragLeave}
                onDragOver={onDragOver}
                onDrop={onDrop}
                className={`block w-full border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors text-gray-600 dark:text-gray-400 ${
                  dragActive
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-300 dark:border-gray-600 hover:border-blue-500"
                }`}
              >
                <FiImage className="mx-auto mb-2" size={32} />
                <p className="font-semibold">
                  {dragActive
                    ? "Drop your files here"
                    : "Drop images or click to upload"}
                </p>
                <p className="text-sm">PNG, JPG, GIF, WebP, or video files</p>
              </button>
            </div>
          </div>

          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span>{files.length} files</span>
              <span>-</span>
              <span>{selectedIds.size} selected</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onSelectAll(visibleFiles.map((file) => file.id))}
                disabled={visibleFiles.length === 0}
                className="px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 disabled:opacity-50"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={onClearSelection}
                className="px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
              >
                Clear
              </button>

              <select
                value={actionTargetFolderId || ""}
                onChange={(e) =>
                  onActionTargetFolderIdChange(e.target.value || null)
                }
                className="px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Target folder...</option>
                {folders
                  .filter((folder) => folder.id !== activeFolder)
                  .map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
              </select>

              <button
                type="button"
                onClick={() => onApplyBulkAction("copy")}
                disabled={
                  selectedIds.size === 0 ||
                  !actionTargetFolderId ||
                  isBulkWorking
                }
                className="px-3 py-1.5 text-xs rounded bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 disabled:opacity-50"
              >
                <FiCopy className="inline mr-1" /> Copy
              </button>
              <button
                type="button"
                onClick={() => onApplyBulkAction("move")}
                disabled={
                  selectedIds.size === 0 ||
                  !actionTargetFolderId ||
                  isBulkWorking
                }
                className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white disabled:opacity-50"
              >
                <FiMove className="inline mr-1" /> Move
              </button>
              <button
                type="button"
                onClick={() => onApplyBulkAction("delete")}
                disabled={selectedIds.size === 0 || isBulkWorking}
                className="px-3 py-1.5 text-xs rounded bg-red-600 text-white disabled:opacity-50"
              >
                <FiTrash2 className="inline mr-1" /> Delete
              </button>
            </div>
          </div>

          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                Sort
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="name">Name A–Z</option>
                  <option value="newest">Newest</option>
                  <option value="views">Most viewed</option>
                  <option value="downloads">Most downloaded</option>
                </select>
              </label>

              <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                Show
                <select
                  value={filterBy}
                  onChange={(e) => setFilterBy(e.target.value as FilterBy)}
                  className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All files</option>
                  <option value="viewed">Viewed</option>
                  <option value="downloaded">Downloaded</option>
                  <option value="requested">Requested</option>
                </select>
              </label>
            </div>

            <p className="text-xs text-gray-500 dark:text-gray-400">
              {files.length} files · {totals.views} views · {totals.downloads}{" "}
              downloads
            </p>
          </div>

          {conflictInfo && (
            <div className="mb-4 rounded-lg border border-yellow-300 bg-yellow-50 text-yellow-900 p-3 text-sm">
              <p className="font-semibold mb-2">
                Conflicts detected in target folder.
              </p>
              <div className="max-h-28 overflow-y-auto mb-3">
                <ul className="list-disc list-inside">
                  {conflictInfo.conflicts.map((conflict) => (
                    <li key={conflict.fileId}>{conflict.fileName}</li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onResolveConflicts("rename")}
                  className="px-3 py-1.5 text-xs rounded bg-yellow-600 text-white"
                >
                  Auto-rename
                </button>
                <button
                  type="button"
                  onClick={() => onResolveConflicts("replace")}
                  className="px-3 py-1.5 text-xs rounded bg-red-600 text-white"
                >
                  Replace
                </button>
                <button
                  type="button"
                  onClick={() => onResolveConflicts("skip")}
                  className="px-3 py-1.5 text-xs rounded bg-gray-200 text-gray-900"
                >
                  Skip conflicts
                </button>
              </div>
            </div>
          )}

          {visibleFiles.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 max-h-[520px] overflow-y-auto pr-1">
              {visibleFiles.map((file) => {
                const selected = selectedIds.has(file.id);
                const preview = getPreviewPath(file);
                return (
                  <div
                    key={file.id}
                    className={`relative text-left rounded-lg overflow-hidden border transition-all group cursor-pointer ${
                      selected
                        ? "border-blue-500 ring-2 ring-blue-400"
                        : "border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    <button
                      type="button"
                      aria-label={`${selected ? "Deselect" : "Select"} ${file.fileName}`}
                      aria-pressed={selected}
                      onClick={() => onToggleSelect(file.id)}
                      className="absolute inset-0 z-10 h-full w-full border-0 bg-transparent p-0"
                    />
                    <div className="relative aspect-square bg-gray-100 dark:bg-gray-900">
                      {preview ? (
                        <Image
                          src={preview}
                          alt={file.fileName}
                          fill
                          unoptimized
                          className="object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                          No preview
                        </div>
                      )}
                    </div>

                    <div className="p-2">
                      <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                        {file.fileName}
                      </p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">
                        {formatFileSize(file.fileSize)} - {file.fileType}
                      </p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">
                        {file.viewCount} views · {file.downloadCount} downloads
                      </p>
                      {file.pendingRequests > 0 && (
                        <span
                          title={`${file.pendingRequests} pending request(s)`}
                          className="mt-1 inline-block rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                        >
                          Requested
                        </span>
                      )}
                    </div>

                    <div
                      className={`absolute top-2 left-2 h-5 w-5 rounded-full border flex items-center justify-center text-[10px] ${
                        selected
                          ? "bg-blue-600 border-blue-500 text-white"
                          : "bg-white/80 border-gray-300 text-gray-700"
                      }`}
                    >
                      {selected ? "x" : ""}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSetFolderThumbnail(file.id);
                      }}
                      className="absolute top-2 right-2 z-20 px-2 py-1 text-[10px] rounded bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Set as folder thumbnail"
                    >
                      Set thumbnail
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              {files.length === 0
                ? "No images in this folder yet"
                : "No files match this filter."}
            </div>
          )}
        </>
      ) : (
        <div className="text-center text-gray-500 dark:text-gray-400 py-12">
          Select a folder from the left to upload images
        </div>
      )}
    </div>
  );
}
