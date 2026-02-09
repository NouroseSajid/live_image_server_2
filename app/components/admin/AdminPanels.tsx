import type { ConflictInfo, FileEntry, Folder, FolderListItem } from "./types";
import FilesPanel from "./FilesPanel";
import FolderSidebar from "./FolderSidebar";

interface AdminPanelsProps {
  folders: Folder[];
  isLoading: boolean;
  activeFolder: string | null;
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
}

export default function AdminPanels({
  folders,
  isLoading,
  activeFolder,
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
}: AdminPanelsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-1">
        <FolderSidebar
          folders={folders}
          isLoading={isLoading}
          activeFolderId={activeFolder}
          newFolderName={newFolderName}
          onNewFolderNameChange={onNewFolderNameChange}
          onCreateFolder={onCreateFolder}
          onShowGroupModal={onShowGroupModal}
          allThumbnailUrl={allThumbnailUrl}
          allThumbnailPreview={allThumbnailPreview}
          allThumbnailUploading={allThumbnailUploading}
          hasAllThumbnailFile={hasAllThumbnailFile}
          onAllThumbnailSelect={onAllThumbnailSelect}
          onUploadAllThumbnail={onUploadAllThumbnail}
          filterTargetId={filterTargetId}
          filterMinutes={filterMinutes}
          filterNoLimit={filterNoLimit}
          filterSaving={filterSaving}
          onFilterTargetIdChange={onFilterTargetIdChange}
          onFilterMinutesChange={onFilterMinutesChange}
          onFilterNoLimitChange={onFilterNoLimitChange}
          onSaveFilter={onSaveFilter}
          folderListItems={folderListItems}
          selectedOrderIndex={selectedOrderIndex}
          orderCount={orderCount}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
          isOrderDirty={isOrderDirty}
          onSaveOrder={onSaveOrder}
          onToggleGroupOpen={onToggleGroupOpen}
          onSelectFolder={onSelectFolder}
          onEditFolder={onEditFolder}
          onDeleteFolder={onDeleteFolder}
        />
      </div>

      <div className="lg:col-span-2">
        <FilesPanel
          activeFolder={activeFolder}
          folders={folders}
          files={files}
          dragActive={dragActive}
          dragRef={dragRef}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onUploadImage={onUploadImage}
          selectedIds={selectedIds}
          actionTargetFolderId={actionTargetFolderId}
          onActionTargetFolderIdChange={onActionTargetFolderIdChange}
          onSelectAll={onSelectAll}
          onClearSelection={onClearSelection}
          onApplyBulkAction={onApplyBulkAction}
          conflictInfo={conflictInfo}
          onResolveConflicts={onResolveConflicts}
          onToggleSelect={onToggleSelect}
          onSetFolderThumbnail={onSetFolderThumbnail}
          isBulkWorking={isBulkWorking}
          loading={isLoading}
        />
      </div>
    </div>
  );
}
