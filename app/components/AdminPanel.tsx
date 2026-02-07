"use client";

import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  FiEdit2,
  FiFolder,
  FiImage,
  FiMove,
  FiPlus,
  FiCopy,
  FiTrash2,
} from "react-icons/fi";
import { useUploads } from "@/app/lib/useUploads";
import FolderEditorModal from "./FolderEditorModal";
import IngestFolderSelector from "./IngestFolderSelector";

interface Folder {
  id: string;
  name: string;
  uniqueUrl: string;
  isPrivate: boolean;
  visible: boolean;
  passphrase: string | null;
  inGridView: boolean;
  folderThumb: string | null;
}

interface File {
  id: string;
  fileName: string;
  fileType: "image" | "video";
  fileSize: string;
  folderId: string;
  createdAt: string;
  order?: number;
  variants: Array<{
    id: string;
    name: string;
    path: string;
    size: string;
  }>;
}

interface ConflictInfo {
  action: "move" | "copy";
  targetFolderId: string;
  conflicts: Array<{
    fileId: string;
    fileName: string;
    existingFileId: string;
  }>;
}

export default function AdminPanel() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const { add } = useUploads();
  const [dragActive, setDragActive] = useState<boolean>(false);
  const dragRef = useRef<HTMLLabelElement | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionTargetFolderId, setActionTargetFolderId] = useState<string | null>(
    null,
  );
  const [isBulkWorking, setIsBulkWorking] = useState(false);
  const [conflictInfo, setConflictInfo] = useState<ConflictInfo | null>(null);

  // Form states
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [_uploadedFile, _setUploadedFile] = useState<File | null>(null);
  const [allThumbnailUrl, setAllThumbnailUrl] = useState<string | null>(null);
  const [allThumbnailUploading, setAllThumbnailUploading] = useState(false);
  const [allThumbnailFile, setAllThumbnailFile] = useState<File | null>(null);
  const [allThumbnailPreview, setAllThumbnailPreview] = useState<string | null>(null);
  const [folderMaxAgeMinutes, setFolderMaxAgeMinutes] = useState<
    Record<string, number | null>
  >({});
  const [filterTargetId, setFilterTargetId] = useState<string>("all");
  const [filterMinutes, setFilterMinutes] = useState<number>(5);
  const [filterNoLimit, setFilterNoLimit] = useState<boolean>(true);
  const [filterSaving, setFilterSaving] = useState(false);
  const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

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

  const fetchFiles = useCallback(async (folderId: string) => {
    try {
      const res = await fetch(`/api/folders/${folderId}/files`);
      if (!res.ok) throw new Error("Failed to fetch files");
      const data = await res.json();
      setFiles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching files");
    }
  }, []);

  // Fetch folders on mount
  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  useEffect(() => {
    const fetchGalleryConfig = async () => {
      try {
        const res = await fetch("/api/gallery-config");
        if (res.ok) {
          const data = await res.json();
          setAllThumbnailUrl(data?.allFolderThumbnailUrl ?? null);
          setFolderMaxAgeMinutes(data?.folderMaxAgeMinutes ?? {});
        }
      } catch (err) {
        console.error("Failed to fetch gallery config", err);
      }
    };
    fetchGalleryConfig();
  }, []);

  useEffect(() => {
    const current = folderMaxAgeMinutes?.[filterTargetId] ?? null;
    if (current === null || current === undefined) {
      setFilterNoLimit(true);
      setFilterMinutes(5);
    } else {
      setFilterNoLimit(false);
      setFilterMinutes(current);
    }
  }, [folderMaxAgeMinutes, filterTargetId]);

  // Fetch files when active folder changes
  useEffect(() => {
    if (activeFolder) {
      fetchFiles(activeFolder);
    }
  }, [activeFolder, fetchFiles]);

  useEffect(() => {
    setSelectedIds(new Set());
    setActionTargetFolderId(null);
  }, [activeFolder, files.length]);

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

  const handleAllThumbnailSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAllThumbnailFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setAllThumbnailPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadAllThumbnail = async () => {
    if (!allThumbnailFile) {
      setError("Select an image for the All folder thumbnail first");
      return;
    }
    try {
      setAllThumbnailUploading(true);
      setError(null);
      const formData = new FormData();
      formData.append("file", allThumbnailFile);
      const res = await fetch("/api/gallery-config/thumbnail", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to upload thumbnail");
      }
      const data = await res.json();
      setAllThumbnailUrl(data?.allFolderThumbnailUrl ?? null);
      setAllThumbnailFile(null);
      setAllThumbnailPreview(null);
      setSuccess("All folder thumbnail updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload thumbnail");
    } finally {
      setAllThumbnailUploading(false);
    }
  };

  const saveFolderAgeFilter = async () => {
    try {
      setFilterSaving(true);
      setError(null);
      const nextMap = {
        ...folderMaxAgeMinutes,
        [filterTargetId]: filterNoLimit ? null : Math.max(1, filterMinutes),
      };

      const res = await fetch("/api/gallery-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allFolderThumbnailUrl: allThumbnailUrl,
          folderMaxAgeMinutes: nextMap,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to save time filter");
      }

      setFolderMaxAgeMinutes(nextMap);
      setSuccess("Gallery time filter updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save time filter");
    } finally {
      setFilterSaving(false);
    }
  };

  const saveFolderOrder = async (orderedFolders: Folder[]) => {
    try {
      const order = orderedFolders.map((f) => f.id);
      const res = await fetch("/api/gallery-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderOrder: order }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to save folder order");
      }

      setSuccess("Folder order saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save folder order");
    }
  };

  const reorderFolders = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const current = [...folders];
    const fromIndex = current.findIndex((f) => f.id === fromId);
    const toIndex = current.findIndex((f) => f.id === toId);
    if (fromIndex === -1 || toIndex === -1) return;
    const [moved] = current.splice(fromIndex, 1);
    current.splice(toIndex, 0, moved);
    setFolders(current);
    saveFolderOrder(current);
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

  const updateFolder = async (updated: Partial<Folder>) => {
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
        setFiles([]);
      }
      setSuccess("Folder deleted successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error deleting folder");
    } finally {
      setLoading(false);
    }
  };

  // handle drag events
  const handleDrag = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  // handle drop events
  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (!activeFolder) {
      setError("Please select a folder first");
      return;
    }
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      if (activeFolder) {
        // Ensure activeFolder is not null before adding
        add(Array.from(e.dataTransfer.files), activeFolder); // Pass activeFolder
        setSuccess(
          `Added ${e.dataTransfer.files.length} file(s) from drop to upload queue.`,
        );
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError("Please select a folder first to drop files.");
      }
    }
  };

  const uploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeFolder) {
      setError("Please select a folder first");
      return;
    }

    const files = e.target.files;
    if (!files || files.length === 0) return;

    e.target.value = ""; // Clear the input so same file can be selected again
    if (activeFolder) {
      // Ensure activeFolder is not null before adding
      add(Array.from(files), activeFolder); // Pass activeFolder
      // The headless Uploader.tsx will now handle the actual upload
      // and UploadsToast will display the progress and notifications.
      setSuccess(`Added ${files.length} file(s) to upload queue.`);
      setTimeout(() => setSuccess(null), 3000);
      // setFiles will be updated when the upload completes and new files are returned from the API
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selectAll = () => setSelectedIds(new Set(files.map((f) => f.id)));

  const applyBulkAction = async (
    action: "move" | "copy" | "delete",
    conflictResolution?: "rename" | "replace" | "skip",
    overrideTargetFolderId?: string,
  ) => {
    if (selectedIds.size === 0) return;
    const targetFolderId = overrideTargetFolderId || actionTargetFolderId;
    if ((action === "move" || action === "copy") && !targetFolderId) {
      setError("Please select a target folder");
      return;
    }

    const confirmed =
      action === "delete"
        ? window.confirm(
            `Delete ${selectedIds.size} file(s)?\n\nThis action cannot be undone.`,
          )
        : true;
    if (!confirmed) return;

    try {
      setIsBulkWorking(true);
      const res = await fetch("/api/images/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          fileIds: Array.from(selectedIds),
          targetFolderId,
          conflictResolution,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data?.conflicts) {
        setConflictInfo({
          action: action === "delete" ? "move" : action,
          targetFolderId: targetFolderId || "",
          conflicts: data.conflicts,
        });
        return;
      }
      if (!res.ok) {
        throw new Error(data.error || "Failed to update files");
      }

      setConflictInfo(null);

      if (action === "delete") {
        const deletedIds = new Set(data.deletedIds || []);
        setFiles((prev) => prev.filter((f) => !deletedIds.has(f.id)));
        setSuccess("Files deleted");
        clearSelection();
      } else if (action === "move") {
        const movedIds = new Set(data.movedIds || []);
        setFiles((prev) => prev.filter((f) => !movedIds.has(f.id)));
        setSuccess("Files moved");
        if (Array.isArray(data.skippedIds) && data.skippedIds.length > 0) {
          setSelectedIds(new Set(data.skippedIds));
        } else {
          clearSelection();
        }
      } else if (action === "copy") {
        if (activeFolder && targetFolderId === activeFolder) {
          setFiles((prev) => [...(data.copied || []), ...prev]);
        }
        setSuccess("Files copied");
        if (Array.isArray(data.skippedIds) && data.skippedIds.length > 0) {
          setSelectedIds(new Set(data.skippedIds));
        } else {
          clearSelection();
        }
      }
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error updating files");
    } finally {
      setIsBulkWorking(false);
    }
  };

  const resolveConflicts = (
    resolution: "rename" | "replace" | "skip",
  ) => {
    if (!conflictInfo) return;
    applyBulkAction(
      conflictInfo.action,
      resolution,
      conflictInfo.targetFolderId,
    );
  };

  const formatFileSize = (bytes: string) => {
    const size = Number(bytes);
    if (!Number.isFinite(size) || size === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(size) / Math.log(k));
    return `${Math.round((size / k ** i) * 100) / 100} ${sizes[i]}`;
  };

  const getPreviewPath = (file: File) => {
    const thumb = file.variants.find((v) => v.name === "thumbnail")?.path;
    const webp = file.variants.find((v) => v.name === "webp")?.path;
    const original = file.variants.find((v) => v.name === "original")?.path;
    return thumb || webp || original || "";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-8">
          Admin Panel
        </h1>

        {/* Alert Messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-200">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-green-700 dark:text-green-200">
            {success}
          </div>
        )}

        {/* Ingest Configuration Section */}
        <div className="mb-8">
          <IngestFolderSelector folders={folders} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Folder Management */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
              <div className="flex items-center mb-6">
                <FiFolder className="mr-2 text-blue-500" size={24} />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Folders
                </h2>
              </div>

              {/* All Folder Thumbnail */}
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
                      onChange={handleAllThumbnailSelect}
                      className="block w-full text-xs text-gray-600 dark:text-gray-300 file:mr-4 file:py-2 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-gray-100 dark:file:bg-gray-700 file:text-gray-700 dark:file:text-gray-200"
                    />
                    <button
                      onClick={uploadAllThumbnail}
                      disabled={allThumbnailUploading || !allThumbnailFile}
                      className="mt-3 px-3 py-1.5 text-xs rounded bg-gray-900 text-white disabled:opacity-50"
                    >
                      {allThumbnailUploading ? "Uploading..." : "Upload"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Gallery Time Filter */}
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
                    onChange={(e) => setFilterTargetId(e.target.value)}
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
                      onChange={(e) => setFilterNoLimit(e.target.checked)}
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
                      onChange={(e) => setFilterMinutes(Number(e.target.value))}
                      disabled={filterNoLimit}
                      className="flex-1"
                    />
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={filterMinutes}
                      onChange={(e) => setFilterMinutes(Number(e.target.value))}
                      disabled={filterNoLimit}
                      className="w-20 px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      minutes
                    </span>
                  </div>

                  <button
                    onClick={saveFolderAgeFilter}
                    disabled={filterSaving}
                    className="px-3 py-1.5 text-xs rounded bg-gray-900 text-white disabled:opacity-50"
                  >
                    {filterSaving ? "Saving..." : "Save filter"}
                  </button>
                </div>
              </div>

              {/* Create Folder */}
              <div className="mb-6">
                <input
                  type="text"
                  placeholder="New folder name..."
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 mb-2"
                  onKeyPress={(e) => e.key === "Enter" && createFolder()}
                />
                <button
                  onClick={createFolder}
                  disabled={loading}
                  className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center"
                >
                  <FiPlus className="mr-2" /> Create Folder
                </button>
              </div>

              {/* Folder List */}
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {loading && folders.length === 0 ? (
                  <div className="text-gray-500 dark:text-gray-400">
                    Loading folders...
                  </div>
                ) : folders.length === 0 ? (
                  <div className="text-gray-500 dark:text-gray-400">
                    No folders yet
                  </div>
                ) : (
                  folders.map((folder) => (
                    <div
                      key={folder.id}
                      draggable
                      onDragStart={() => setDraggedFolderId(folder.id)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragOverFolderId !== folder.id) {
                          setDragOverFolderId(folder.id);
                        }
                      }}
                      onDragLeave={() => {
                        if (dragOverFolderId === folder.id) {
                          setDragOverFolderId(null);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (draggedFolderId) {
                          reorderFolders(draggedFolderId, folder.id);
                        }
                        setDraggedFolderId(null);
                        setDragOverFolderId(null);
                      }}
                      className={`p-3 rounded-lg cursor-pointer transition-colors ${
                        activeFolder === folder.id
                          ? "bg-blue-50 dark:bg-blue-900/30 border border-blue-500"
                          : "bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600"
                      } ${
                        dragOverFolderId === folder.id
                          ? "ring-2 ring-blue-400"
                          : ""
                      }`}
                      onClick={() => setActiveFolder(folder.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">
                            {folder.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {folder.uniqueUrl}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingFolder(folder);
                            }}
                            className="text-blue-500 hover:text-blue-600 p-1"
                            title="Edit folder settings"
                          >
                            <FiEdit2 size={16} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteFolder(folder.id);
                            }}
                            className="text-red-500 hover:text-red-600 p-1"
                            title="Delete folder"
                          >
                            <FiTrash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Image Upload and Display */}
          <div className="lg:col-span-2">
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
                  {/* Upload Area */}
                  <div className="mb-6">
                    <label
                      ref={dragRef} // Assign the ref
                      className={`block border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                        ${dragActive ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-300 dark:border-gray-600 hover:border-blue-500"}`}
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                    >
                      <input
                        type="file"
                        multiple
                        accept="image/*,video/*"
                        onChange={uploadImage}
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
                        <p className="text-sm">
                          PNG, JPG, GIF, WebP, or video files
                        </p>
                      </div>
                    </label>
                  </div>

                  {/* Bulk Actions */}
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <span>{files.length} files</span>
                      <span>•</span>
                      <span>{selectedIds.size} selected</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={selectAll}
                        className="px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
                      >
                        Select all
                      </button>
                      <button
                        onClick={clearSelection}
                        className="px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
                      >
                        Clear
                      </button>

                      <select
                        value={actionTargetFolderId || ""}
                        onChange={(e) =>
                          setActionTargetFolderId(e.target.value || null)
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
                        onClick={() => applyBulkAction("copy")}
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
                        onClick={() => applyBulkAction("move")}
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
                        onClick={() => applyBulkAction("delete")}
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
                          onClick={() => resolveConflicts("rename")}
                          className="px-3 py-1.5 text-xs rounded bg-yellow-600 text-white"
                        >
                          Auto-rename
                        </button>
                        <button
                          onClick={() => resolveConflicts("replace")}
                          className="px-3 py-1.5 text-xs rounded bg-red-600 text-white"
                        >
                          Replace
                        </button>
                        <button
                          onClick={() => resolveConflicts("skip")}
                          className="px-3 py-1.5 text-xs rounded bg-gray-200 text-gray-900"
                        >
                          Skip conflicts
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Files Grid */}
                  {files.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3 max-h-[520px] overflow-y-auto pr-1">
                      {files.map((file) => {
                        const selected = selectedIds.has(file.id);
                        const preview = getPreviewPath(file);
                        return (
                          <button
                            key={file.id}
                            type="button"
                            onClick={() => toggleSelect(file.id)}
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
                                {formatFileSize(file.fileSize)} • {file.fileType}
                              </p>
                            </div>

                            <div
                              className={`absolute top-2 left-2 h-5 w-5 rounded-full border flex items-center justify-center text-[10px] ${
                                selected
                                  ? "bg-blue-600 border-blue-500 text-white"
                                  : "bg-white/80 border-gray-300 text-gray-700"
                              }`}
                            >
                              {selected ? "✓" : ""}
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAsFolderThumbnail(file.id);
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
          </div>
        </div>
      </div>

      {/* Folder Editor Modal */}
      {editingFolder && (
        <FolderEditorModal
          folder={editingFolder}
          onClose={() => setEditingFolder(null)}
          onSave={updateFolder}
          isLoading={isSaving}
        />
      )}
    </div>
  );
}
