import { FiFolder, FiPlus } from "react-icons/fi";
import FolderList from "./FolderList";
import type { Folder, FolderListItem } from "./types";

interface FolderSidebarProps {
  folders: Folder[];
  isLoading: boolean;
  activeFolderId: string | null;
  newFolderName: string;
  onNewFolderNameChange: (value: string) => void;
  onCreateFolder: () => void;
  onShowGroupModal: () => void;
  allThumbnailUrl: string | null;
  allThumbnailPreview: string | null;
  allThumbnailUploading: boolean;
  hasAllThumbnailFile: boolean;
  onAllThumbnailSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onUploadAllThumbnail: () => void;
  filterTargetId: string;
  filterMinutes: number;
  filterNoLimit: boolean;
  filterSaving: boolean;
  onFilterTargetIdChange: (value: string) => void;
  onFilterMinutesChange: (value: number) => void;
  onFilterNoLimitChange: (value: boolean) => void;
  onSaveFilter: () => void;
  folderListItems: FolderListItem[];
  selectedOrderIndex: number | null;
  orderCount: number;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isOrderDirty: boolean;
  onSaveOrder: () => void;
  onToggleGroupOpen: (groupId: string) => void;
  onSelectFolder: (folderId: string) => void;
  onEditFolder: (folder: Folder) => void;
  onDeleteFolder: (folderId: string) => void;
}

export default function FolderSidebar({
  folders,
  isLoading,
  activeFolderId,
  newFolderName,
  onNewFolderNameChange,
  onCreateFolder,
  onShowGroupModal,
  allThumbnailUrl,
  allThumbnailPreview,
  allThumbnailUploading,
  hasAllThumbnailFile,
  onAllThumbnailSelect,
  onUploadAllThumbnail,
  filterTargetId,
  filterMinutes,
  filterNoLimit,
  filterSaving,
  onFilterTargetIdChange,
  onFilterMinutesChange,
  onFilterNoLimitChange,
  onSaveFilter,
  folderListItems,
  selectedOrderIndex,
  orderCount,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  isOrderDirty,
  onSaveOrder,
  onToggleGroupOpen,
  onSelectFolder,
  onEditFolder,
  onDeleteFolder,
}: FolderSidebarProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <div className="flex items-center mb-6">
        <FiFolder className="mr-2 text-blue-500" size={24} />
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Folders
        </h2>
        <button
          type="button"
          onClick={onShowGroupModal}
          className="ml-auto px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
        >
          Manage groups
        </button>
      </div>

      <div className="mb-6 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-gray-900 dark:text-white">
            All Folder Thumbnail
          </p>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Used on the main gallery
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-24 h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            {allThumbnailPreview || allThumbnailUrl ? (
              <img
                src={allThumbnailPreview || allThumbnailUrl || ""}
                alt="All folder thumbnail preview"
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-xs text-gray-400">No thumbnail</span>
            )}
          </div>
          <div className="flex-1">
            <input
              type="file"
              accept="image/*"
              onChange={onAllThumbnailSelect}
              className="block w-full text-xs text-gray-600 dark:text-gray-300 file:mr-4 file:py-2 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-gray-100 dark:file:bg-gray-700 file:text-gray-700 dark:file:text-gray-200"
            />
            <button
              onClick={onUploadAllThumbnail}
              disabled={allThumbnailUploading || !hasAllThumbnailFile}
              className="mt-3 px-3 py-1.5 text-xs rounded bg-gray-900 text-white disabled:opacity-50"
            >
              {allThumbnailUploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-gray-900 dark:text-white">
            Gallery Time Filter
          </p>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Show only recent images
          </span>
        </div>

        <div className="space-y-3">
          <label className="text-xs text-gray-600 dark:text-gray-300">
            Folder
          </label>
          <select
            value={filterTargetId}
            onChange={(e) => onFilterTargetIdChange(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">All (main page)</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={filterNoLimit}
              onChange={(e) => onFilterNoLimitChange(e.target.checked)}
            />
            No time filter
          </label>

          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={120}
              step={1}
              value={filterMinutes}
              onChange={(e) => onFilterMinutesChange(Number(e.target.value))}
              disabled={filterNoLimit}
              className="flex-1"
            />
            <input
              type="number"
              min={1}
              max={120}
              value={filterMinutes}
              onChange={(e) => onFilterMinutesChange(Number(e.target.value))}
              disabled={filterNoLimit}
              className="w-20 px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            <span className="text-xs text-gray-500 dark:text-gray-400">minutes</span>
          </div>

          <button
            onClick={onSaveFilter}
            disabled={filterSaving}
            className="px-3 py-1.5 text-xs rounded bg-gray-900 text-white disabled:opacity-50"
          >
            {filterSaving ? "Saving..." : "Save filter"}
          </button>
        </div>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="New folder name..."
          value={newFolderName}
          onChange={(e) => onNewFolderNameChange(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 mb-2"
          onKeyPress={(e) => e.key === "Enter" && onCreateFolder()}
        />
        <button
          onClick={onCreateFolder}
          disabled={isLoading}
          className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
        >
          <FiPlus className="mr-2" /> Create Folder
        </button>
      </div>

      <div className="mb-6 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-gray-900 dark:text-white">
            Order Controls
          </p>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {orderCount} items
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
          <span>Selected index:</span>
          <span className="rounded-full border border-gray-200 dark:border-gray-700 px-2 py-0.5 text-[10px]">
            {selectedOrderIndex !== null ? `#${selectedOrderIndex + 1}` : "None"}
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={!canMoveUp}
            className="px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 disabled:opacity-50"
          >
            Move up
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={!canMoveDown}
            className="px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 disabled:opacity-50"
          >
            Move down
          </button>
          <button
            type="button"
            onClick={onSaveOrder}
            disabled={!isOrderDirty}
            className="ml-auto px-3 py-1.5 text-xs rounded bg-gray-900 text-white disabled:opacity-50"
          >
            Save order
          </button>
        </div>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {isLoading && folders.length === 0 ? (
          <div className="text-gray-500 dark:text-gray-400">Loading folders...</div>
        ) : folders.length === 0 ? (
          <div className="text-gray-500 dark:text-gray-400">No folders yet</div>
        ) : (
          <FolderList
            items={folderListItems}
            activeFolderId={activeFolderId}
            onToggleGroupOpen={onToggleGroupOpen}
            onSelectFolder={onSelectFolder}
            onEditFolder={onEditFolder}
            onDeleteFolder={onDeleteFolder}
          />
        )}
      </div>
    </div>
  );
}
