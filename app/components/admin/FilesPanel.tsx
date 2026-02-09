import { FiCopy, FiImage, FiMove, FiTrash2 } from "react-icons/fi";
import { formatFileSize, getPreviewPath } from "./fileUtils";
import type { ConflictInfo, FileEntry, Folder } from "./types";

interface FilesPanelProps {
  activeFolder: string | null;
  folders: Folder[];
  files: FileEntry[];
  dragActive: boolean;
  dragRef: React.RefObject<HTMLLabelElement | null>;
  onDragEnter: (event: React.DragEvent<HTMLLabelElement>) => void;
  onDragLeave: (event: React.DragEvent<HTMLLabelElement>) => void;
  onDragOver: (event: React.DragEvent<HTMLLabelElement>) => void;
  onDrop: (event: React.DragEvent<HTMLLabelElement>) => void;
  onUploadImage: (event: React.ChangeEvent<HTMLInputElement>) => void;
  selectedIds: Set<string>;
  actionTargetFolderId: string | null;
  onActionTargetFolderIdChange: (value: string | null) => void;
  onSelectAll: () => void;
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
            <label
              ref={dragRef}
              className={`block border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                ${dragActive ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-300 dark:border-gray-600 hover:border-blue-500"}`}
              onDragEnter={onDragEnter}
              onDragLeave={onDragLeave}
              onDragOver={onDragOver}
              onDrop={onDrop}
            >
              <input
                type="file"
                multiple
                accept="image/*,video/*"
                onChange={onUploadImage}
                className="hidden"
                disabled={loading}
              />
              <div className="text-gray-600 dark:text-gray-400">
                <FiImage className="mx-auto mb-2" size={32} />
                <p className="font-semibold">
                  {dragActive
                    ? "Drop your files here"
                    : "Drop images or click to upload"}
                </p>
                <p className="text-sm">PNG, JPG, GIF, WebP, or video files</p>
              </div>
            </label>
          </div>

          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span>{files.length} files</span>
              <span>-</span>
              <span>{selectedIds.size} selected</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={onSelectAll}
                className="px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
              >
                Select all
              </button>
              <button
                onClick={onClearSelection}
                className="px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
              >
                Clear
              </button>

              <select
                value={actionTargetFolderId || ""}
                onChange={(e) => onActionTargetFolderIdChange(e.target.value || null)}
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
                onClick={() => onApplyBulkAction("delete")}
                disabled={selectedIds.size === 0 || isBulkWorking}
                className="px-3 py-1.5 text-xs rounded bg-red-600 text-white disabled:opacity-50"
              >
                <FiTrash2 className="inline mr-1" /> Delete
              </button>
            </div>
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
                  onClick={() => onResolveConflicts("rename")}
                  className="px-3 py-1.5 text-xs rounded bg-yellow-600 text-white"
                >
                  Auto-rename
                </button>
                <button
                  onClick={() => onResolveConflicts("replace")}
                  className="px-3 py-1.5 text-xs rounded bg-red-600 text-white"
                >
                  Replace
                </button>
                <button
                  onClick={() => onResolveConflicts("skip")}
                  className="px-3 py-1.5 text-xs rounded bg-gray-200 text-gray-900"
                >
                  Skip conflicts
                </button>
              </div>
            </div>
          )}

          {files.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 max-h-[520px] overflow-y-auto pr-1">
              {files.map((file) => {
                const selected = selectedIds.has(file.id);
                const preview = getPreviewPath(file);
                return (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => onToggleSelect(file.id)}
                    className={`relative text-left rounded-lg overflow-hidden border transition-all group ${
                      selected
                        ? "border-blue-500 ring-2 ring-blue-400"
                        : "border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    <div className="aspect-square bg-gray-100 dark:bg-gray-900">
                      {preview ? (
                        <img
                          src={preview}
                          alt={file.fileName}
                          className="w-full h-full object-cover"
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
                      className="absolute top-2 right-2 px-2 py-1 text-[10px] rounded bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Set as folder thumbnail"
                    >
                      Set thumbnail
                    </button>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              No images in this folder yet
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
