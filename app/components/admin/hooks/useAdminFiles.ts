import { useCallback, useEffect, useRef, useState } from "react";
import type { ConflictInfo, FileEntry } from "../types";

interface UseAdminFilesOptions {
  activeFolder: string | null;
  setError: (message: string | null) => void;
  setSuccess: (message: string | null) => void;
  addUploads: (files: File[], folderId: string) => void;
}

export default function useAdminFiles({
  activeFolder,
  setError,
  setSuccess,
  addUploads,
}: UseAdminFilesOptions) {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const dragRef = useRef<HTMLLabelElement | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [actionTargetFolderId, setActionTargetFolderId] = useState<string | null>(
    null,
  );
  const [isBulkWorking, setIsBulkWorking] = useState(false);
  const [conflictInfo, setConflictInfo] = useState<ConflictInfo | null>(null);

  const fetchFiles = useCallback(async (folderId: string) => {
    try {
      const res = await fetch(`/api/folders/${folderId}/files`);
      if (!res.ok) throw new Error("Failed to fetch files");
      const data = await res.json();
      setFiles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching files");
    }
  }, [setError]);

  useEffect(() => {
    if (activeFolder) {
      fetchFiles(activeFolder);
    }
  }, [activeFolder, fetchFiles]);

  useEffect(() => {
    setSelectedIds(new Set());
    setActionTargetFolderId(null);
  }, []);

  const clearFiles = () => setFiles([]);

  const handleDrag = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (!activeFolder) {
      setError("Please select a folder first");
      return;
    }
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addUploads(Array.from(e.dataTransfer.files), activeFolder);
      setSuccess(
        `Added ${e.dataTransfer.files.length} file(s) from drop to upload queue.`,
      );
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const uploadImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeFolder) {
      setError("Please select a folder first");
      return;
    }

    const inputFiles = e.target.files;
    if (!inputFiles || inputFiles.length === 0) return;

    e.target.value = "";
    addUploads(Array.from(inputFiles), activeFolder);
    setSuccess(`Added ${inputFiles.length} file(s) to upload queue.`);
    setTimeout(() => setSuccess(null), 3000);
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

  const resolveConflicts = (resolution: "rename" | "replace" | "skip") => {
    if (!conflictInfo) return;
    applyBulkAction(conflictInfo.action, resolution, conflictInfo.targetFolderId);
  };

  return {
    files,
    setFiles,
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
  };
}
