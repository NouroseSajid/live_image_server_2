"use client";

import { useCallback, useEffect, useState } from "react";
import { useUploads } from "@/app/lib/useUploads";
import IngestFolderSelector from "./IngestFolderSelector";
import AdminAlerts from "./admin/AdminAlerts";
import AdminModals from "./admin/AdminModals";
import AdminPanels from "./admin/AdminPanels";
import useAdminFiles from "./admin/hooks/useAdminFiles";
import useFolderOrdering from "./admin/hooks/useFolderOrdering";
import useGalleryConfig from "./admin/hooks/useGalleryConfig";
import type { FolderUpdate } from "./FolderEditorModal";
import type {
  Folder,
  FolderGroup,
} from "./admin/types";

export default function AdminPanel() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [groups, setGroups] = useState<FolderGroup[]>([]);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { add } = useUploads();

  // Form states
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [_uploadedFile, _setUploadedFile] = useState<File | null>(null);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupDrafts, setGroupDrafts] = useState<Record<string, string>>({});
  const [newGroupName, setNewGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [savingGroupId, setSavingGroupId] = useState<string | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);

  const {
    allThumbnailUrl,
    allThumbnailUploading,
    allThumbnailFile,
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
  } = useGalleryConfig({ setError, setSuccess });

  const {
    files,
    clearFiles,
    dragActive,
    dragRef,
    handleDrag,
    handleDrop,
    uploadImage,
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
  } = useAdminFiles({
    activeFolder,
    setError,
    setSuccess,
    addUploads: add,
  });

  const {
    effectiveOrderItems,
    folderListItems,
    isOrderDirty,
    toggleGroupOpen,
    getFolderIndex,
    moveFolderByDelta,
    saveCurrentOrder,
  } = useFolderOrdering({ folders, groups, setError });

  // Clear error/success messages after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (!showGroupModal) return;
    const next: Record<string, string> = {};
    groups.forEach((group) => {
      next[group.id] = group.name;
    });
    setGroupDrafts(next);
  }, [showGroupModal, groups]);


  const fetchFolders = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/folders");
      if (!res.ok) throw new Error("Failed to fetch folders");
      const data = await res.json();
      setFolders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching folders");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch folders on mount
  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const res = await fetch("/api/folder-groups");
        if (!res.ok) throw new Error("Failed to fetch folder groups");
        const data = await res.json();
        setGroups(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error fetching groups");
      }
    };
    fetchGroups();
  }, []);


  const createFolder = async () => {
    if (!newFolderName.trim()) {
      setError("Folder name cannot be empty");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newFolderName, visible: true }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to create folder");
      }

      const newFolder = await res.json();
      setFolders([...folders, newFolder]);
      setNewFolderName("");
      setSuccess("Folder created successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating folder");
    } finally {
      setLoading(false);
    }
  };

  const refreshGroups = async () => {
    const res = await fetch("/api/folder-groups");
    if (res.ok) {
      const data = await res.json();
      setGroups(data);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) {
      setError("Group name cannot be empty");
      return;
    }

    try {
      setCreatingGroup(true);
      const res = await fetch("/api/folder-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newGroupName.trim() }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to create group");
      }

      const created = await res.json();
      setGroups((prev) => [...prev, created]);
      setNewGroupName("");
      setSuccess("Group created");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creating group");
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleSaveGroup = async (groupId: string) => {
    const name = groupDrafts[groupId]?.trim();
    if (!name) {
      setError("Group name cannot be empty");
      return;
    }

    try {
      setSavingGroupId(groupId);
      const res = await fetch(`/api/folder-groups/${groupId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to update group");
      }

      const updated = await res.json();
      setGroups((prev) =>
        prev.map((group) => (group.id === groupId ? updated : group)),
      );
      setSuccess("Group updated");
      await refreshGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error updating group");
    } finally {
      setSavingGroupId(null);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    const confirmed = window.confirm(
      "Delete this group? Folders in it will be ungrouped.",
    );
    if (!confirmed) return;

    try {
      setDeletingGroupId(groupId);
      const res = await fetch(`/api/folder-groups/${groupId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to delete group");
      }

      setGroups((prev) => prev.filter((group) => group.id !== groupId));
      setSuccess("Group deleted");
      await fetchFolders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting group");
    } finally {
      setDeletingGroupId(null);
    }
  };



  const setAsFolderThumbnail = async (fileId: string) => {
    if (!activeFolder) return;
    try {
      setError(null);
      const res = await fetch(`/api/folders/${activeFolder}/thumbnail/set`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to set folder thumbnail");
      }

      setSuccess("Folder thumbnail updated");
      fetchFolders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set folder thumbnail");
    }
  };

  const updateFolder = async (updated: Partial<FolderUpdate>) => {
    if (!editingFolder) return;

    try {
      setIsSaving(true);
      const res = await fetch(`/api/folders/${editingFolder.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to update folder");
      }

      const updatedFolder = await res.json();
      setFolders(
        folders.map((f) => (f.id === editingFolder.id ? updatedFolder : f)),
      );
      setSuccess("Folder updated successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      throw err instanceof Error ? err : new Error("Error updating folder");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteFolder = async (folderId: string) => {
    const folder = folders.find((f) => f.id === folderId);
    const confirmed = window.confirm(
      `Delete folder "${folder?.name}" and all its contents?\n\nThis action cannot be undone.`,
    );
    if (!confirmed) return;

    try {
      setLoading(true);
      const res = await fetch(`/api/folders/${folderId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to delete folder");
      }

      setFolders(folders.filter((f) => f.id !== folderId));
      if (activeFolder === folderId) {
        setActiveFolder(null);
        clearFiles();
      }
      setSuccess("Folder deleted successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting folder");
    } finally {
      setLoading(false);
    }
  };

  const selectedOrderIndex = getFolderIndex(activeFolder);
  const orderCount = effectiveOrderItems.length;
  const canMoveUp = selectedOrderIndex !== null && selectedOrderIndex > 0;
  const canMoveDown =
    selectedOrderIndex !== null && selectedOrderIndex < orderCount - 1;

  const moveSelectedUp = () => {
    if (!activeFolder) return;
    moveFolderByDelta(activeFolder, -1);
  };

  const moveSelectedDown = () => {
    if (!activeFolder) return;
    moveFolderByDelta(activeFolder, 1);
  };



  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-8">
          Admin Panel
        </h1>

        <AdminAlerts error={error} success={success} />

        {/* Ingest Configuration Section */}
        <div className="mb-8">
          <IngestFolderSelector folders={folders} />
        </div>

        <AdminPanels
          folders={folders}
          isLoading={loading}
          activeFolder={activeFolder}
          newFolderName={newFolderName}
          onNewFolderNameChange={setNewFolderName}
          onCreateFolder={createFolder}
          onShowGroupModal={() => setShowGroupModal(true)}
          allThumbnailUrl={allThumbnailUrl}
          allThumbnailPreview={allThumbnailPreview}
          allThumbnailUploading={allThumbnailUploading}
          hasAllThumbnailFile={Boolean(allThumbnailFile)}
          onAllThumbnailSelect={handleAllThumbnailSelect}
          onUploadAllThumbnail={uploadAllThumbnail}
          filterTargetId={filterTargetId}
          filterMinutes={filterMinutes}
          filterNoLimit={filterNoLimit}
          filterSaving={filterSaving}
          onFilterTargetIdChange={setFilterTargetId}
          onFilterMinutesChange={setFilterMinutes}
          onFilterNoLimitChange={setFilterNoLimit}
          onSaveFilter={saveFolderAgeFilter}
          folderListItems={folderListItems}
          selectedOrderIndex={selectedOrderIndex}
          orderCount={orderCount}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          onMoveUp={moveSelectedUp}
          onMoveDown={moveSelectedDown}
          isOrderDirty={isOrderDirty}
          onSaveOrder={saveCurrentOrder}
          onToggleGroupOpen={toggleGroupOpen}
          onSelectFolder={setActiveFolder}
          onEditFolder={setEditingFolder}
          onDeleteFolder={deleteFolder}
          files={files}
          dragActive={dragActive}
          dragRef={dragRef}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onUploadImage={uploadImage}
          selectedIds={selectedIds}
          actionTargetFolderId={actionTargetFolderId}
          onActionTargetFolderIdChange={setActionTargetFolderId}
          onSelectAll={selectAll}
          onClearSelection={clearSelection}
          onApplyBulkAction={applyBulkAction}
          conflictInfo={conflictInfo}
          onResolveConflicts={resolveConflicts}
          onToggleSelect={toggleSelect}
          onSetFolderThumbnail={setAsFolderThumbnail}
          isBulkWorking={isBulkWorking}
        />
      </div>

      <AdminModals
        editingFolder={editingFolder}
        groups={groups}
        isSaving={isSaving}
        onCloseEditing={() => setEditingFolder(null)}
        onSaveFolder={updateFolder}
        showGroupModal={showGroupModal}
        groupDrafts={groupDrafts}
        newGroupName={newGroupName}
        creatingGroup={creatingGroup}
        savingGroupId={savingGroupId}
        deletingGroupId={deletingGroupId}
        onNewGroupNameChange={setNewGroupName}
        onGroupDraftChange={(groupId, value) =>
          setGroupDrafts((prev) => ({
            ...prev,
            [groupId]: value,
          }))
        }
        onCreateGroup={handleCreateGroup}
        onSaveGroup={handleSaveGroup}
        onDeleteGroup={handleDeleteGroup}
        onCloseGroupModal={() => setShowGroupModal(false)}
      />
    </div>
  );
}
