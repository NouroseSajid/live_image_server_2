"use client";

import { CheckCircle2, X, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useAdminFiles from "@/app/components/admin/hooks/useAdminFiles";
import useFolderOrdering from "@/app/components/admin/hooks/useFolderOrdering";
import useGalleryConfig from "@/app/components/admin/hooks/useGalleryConfig";
import type {
  Folder,
  FolderGroup,
} from "@/app/components/admin/types";
import { useUploads } from "@/app/lib/useUploads";
import AdminNewSidebar from "./AdminNewSidebar";
import FolderDrawer from "./FolderDrawer";
import FoldersSection from "./FoldersSection";
import GroupsDrawer from "./GroupsDrawer";
import LibrarySection from "./LibrarySection";
import OverviewSection from "./OverviewSection";
import RequestsSection from "./RequestsSection";
import SettingsSection from "./SettingsSection";
import type {
  AdminSection,
  FolderDraft,
  ToastKind,
  ToastMessage,
} from "./types";

export default function AdminNewApp({ userLabel }: { userLabel: string }) {
  const [section, setSection] = useState<AdminSection>("overview");
  const [folders, setFolders] = useState<Folder[]>([]);
  const [groups, setGroups] = useState<FolderGroup[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [drawerMode, setDrawerMode] = useState<"create" | "edit" | null>(null);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [showGroups, setShowGroups] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastId = useRef(0);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (kind: ToastKind, message: string) => {
      const id = ++toastId.current;
      setToasts((prev) => [...prev, { id, kind, message }]);
      window.setTimeout(() => dismissToast(id), 4500);
    },
    [dismissToast],
  );

  const setError = useCallback(
    (message: string | null) => {
      if (message) notify("error", message);
    },
    [notify],
  );

  const setSuccess = useCallback(
    (message: string | null) => {
      if (message) notify("success", message);
    },
    [notify],
  );

  const fetchFolders = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoadingFolders(true);
        const res = await fetch("/api/folders");
        if (!res.ok) throw new Error("Failed to load folders");
        const data = await res.json();
        setFolders(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load folders");
      } finally {
        if (!silent) setLoadingFolders(false);
      }
    },
    [setError],
  );

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/folder-groups");
      if (!res.ok) throw new Error("Failed to load folder groups");
      const data = await res.json();
      setGroups(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load folder groups",
      );
    }
  }, [setError]);

  useEffect(() => {
    void fetchFolders();
    void fetchGroups();
  }, [fetchFolders, fetchGroups]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/image-requests?status=PENDING")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const count = data?.counts?.PENDING;
        if (typeof count === "number") setPendingCount(count);
      })
      .catch(() => {
        // The requests section surfaces its own errors.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const { add } = useUploads();

  const filesApi = useAdminFiles({
    activeFolder: activeFolderId,
    setError,
    setSuccess,
    addUploads: add,
  });

  const ordering = useFolderOrdering({ folders, groups, setError });
  const galleryConfig = useGalleryConfig({ setError, setSuccess });

  // Overview follows the same saved gallery order as the Folders panel.
  const orderedFolders = useMemo(() => {
    const byId = new Map(folders.map((folder) => [folder.id, folder]));
    const ids = ordering.effectiveOrderItems
      .filter((item) => item.type === "folder")
      .map((item) => item.id);
    if (ids.length === 0) return folders;
    return ids
      .map((id) => byId.get(id))
      .filter((folder): folder is Folder => Boolean(folder));
  }, [folders, ordering.effectiveOrderItems]);

  const activeFolder =
    folders.find((folder) => folder.id === activeFolderId) ?? null;

  const openFolder = (folderId: string) => {
    setActiveFolderId(folderId);
    setSection("folders");
  };

  const openLibrary = (folderId?: string) => {
    if (folderId) setActiveFolderId(folderId);
    setSection("library");
  };

  const openCreateFolder = () => {
    setEditingFolder(null);
    setDrawerMode("create");
  };

  const openEditFolder = (folder: Folder) => {
    setEditingFolder(folder);
    setDrawerMode("edit");
  };

  const closeFolderDrawer = () => {
    setDrawerMode(null);
    setEditingFolder(null);
  };

  const handleCreateFolder = async (draft: FolderDraft) => {
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || "Failed to create folder");
    }

    setFolders((prev) => [...prev, data]);
    setActiveFolderId(data.id);
    closeFolderDrawer();
    notify("success", "Folder created");
  };

  const handleUpdateFolder = async (draft: FolderDraft) => {
    if (!editingFolder) return;

    const res = await fetch(`/api/folders/${editingFolder.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || "Failed to update folder");
    }

    setFolders((prev) =>
      prev.map((folder) => (folder.id === editingFolder.id ? data : folder)),
    );
    closeFolderDrawer();
    notify("success", "Folder updated");
  };

  const handleDeleteFolder = async (folder: Folder) => {
    const confirmed = window.confirm(
      `Delete "${folder.name}" and all of its contents?\n\nThis cannot be undone.`,
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/folders/${folder.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete folder");
      }

      setFolders((prev) => prev.filter((item) => item.id !== folder.id));
      if (activeFolderId === folder.id) {
        setActiveFolderId(null);
        filesApi.clearFiles();
      }
      notify("success", "Folder deleted");
    } catch (err) {
      notify(
        "error",
        err instanceof Error ? err.message : "Failed to delete folder",
      );
    }
  };

  const handleCreateGroup = async (name: string) => {
    const res = await fetch("/api/folder-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || "Failed to create group");
    }

    setGroups((prev) => [...prev, data]);
    notify("success", "Group created");
  };

  const handleRenameGroup = async (groupId: string, name: string) => {
    const res = await fetch(`/api/folder-groups/${groupId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || "Failed to update group");
    }

    setGroups((prev) =>
      prev.map((group) => (group.id === groupId ? data : group)),
    );
    await fetchFolders(true);
    notify("success", "Group updated");
  };

  const handleDeleteGroup = async (groupId: string) => {
    const confirmed = window.confirm(
      "Delete this group? Folders in it will be ungrouped.",
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/folder-groups/${groupId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete group");
      }

      setGroups((prev) => prev.filter((group) => group.id !== groupId));
      await fetchFolders(true);
      notify("success", "Group deleted");
    } catch (err) {
      notify(
        "error",
        err instanceof Error ? err.message : "Failed to delete group",
      );
    }
  };

  const handleSetFolderThumbnail = async (fileId: string) => {
    if (!activeFolderId) return;

    try {
      const res = await fetch(
        `/api/folders/${activeFolderId}/thumbnail/set`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileId }),
        },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to set folder cover");
      }

      await fetchFolders(true);
      notify("success", "Folder cover updated");
    } catch (err) {
      notify(
        "error",
        err instanceof Error ? err.message : "Failed to set folder cover",
      );
    }
  };

  const handleUploadFolderThumbnail = async (folderId: string, file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`/api/folders/${folderId}/thumbnail`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to upload folder cover");
    }

    await fetchFolders(true);
    notify("success", "Folder cover updated");
  };

  const handleCreateAccessLink = async (folderId: string) => {
    const res = await fetch("/api/access-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || "Failed to create access link");
    }
    if (!data.token) {
      throw new Error("No token returned");
    }

    return `${window.location.origin}/?t=${encodeURIComponent(data.token)}`;
  };

  const handleCreatePermanentLink = async (folderId: string) => {
    const res = await fetch("/api/access-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderId, permanent: true }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || "Failed to create permanent link");
    }
    if (!data.token) {
      throw new Error("No token returned");
    }

    return `${window.location.origin}/?t=${encodeURIComponent(data.token)}`;
  };

  const handleCountsChange = useCallback((counts: { PENDING: number }) => {
    setPendingCount(counts.PENDING);
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 pb-6 pt-[76px] sm:px-6 lg:px-8 lg:pb-8 lg:pt-[88px]">
      <div className="an-shell">
        <AdminNewSidebar
          section={section}
          onSelect={setSection}
          pendingCount={pendingCount}
          userLabel={userLabel}
        />

        <main className="min-w-0 space-y-6">
          {section === "overview" && (
            <OverviewSection
              folders={orderedFolders}
              groupCount={groups.length}
              pendingCount={pendingCount}
              loading={loadingFolders}
              onOpenFolder={openFolder}
              onOpenLibrary={() => openLibrary()}
              onCreateFolder={openCreateFolder}
              onViewAllFolders={() => setSection("folders")}
              onViewRequests={() => setSection("requests")}
            />
          )}

          {section === "library" && (
            <LibrarySection
              folders={folders}
              activeFolder={activeFolder}
              onSelectFolder={setActiveFolderId}
              filesApi={filesApi}
              onSetFolderThumbnail={handleSetFolderThumbnail}
              onCreateFolder={openCreateFolder}
            />
          )}

          {section === "folders" && (
            <FoldersSection
              folders={folders}
              groups={groups}
              activeFolderId={activeFolderId}
              onSelectFolder={setActiveFolderId}
              ordering={ordering}
              onCreateFolder={openCreateFolder}
              onEditFolder={openEditFolder}
              onDeleteFolder={handleDeleteFolder}
              onManageGroups={() => setShowGroups(true)}
              onCreateAccessLink={handleCreateAccessLink}
              onCreatePermanentLink={handleCreatePermanentLink}
              onOpenLibrary={openLibrary}
              onNotify={notify}
            />
          )}

          {section === "requests" && (
            <RequestsSection onCountsChange={handleCountsChange} />
          )}

          {section === "settings" && (
            <SettingsSection folders={folders} galleryConfig={galleryConfig} />
          )}
        </main>
      </div>

      <FolderDrawer
        key={drawerMode === "edit" ? (editingFolder?.id ?? "edit") : "create"}
        mode={drawerMode ?? "create"}
        open={drawerMode !== null}
        folder={editingFolder}
        groups={groups}
        onClose={closeFolderDrawer}
        onCreate={handleCreateFolder}
        onUpdate={handleUpdateFolder}
        onUploadThumbnail={handleUploadFolderThumbnail}
      />

      <GroupsDrawer
        open={showGroups}
        groups={groups}
        onClose={() => setShowGroups(false)}
        onCreate={handleCreateGroup}
        onRename={handleRenameGroup}
        onDelete={handleDeleteGroup}
      />

      <div className="an-toasts" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className="an-toast" role="status">
            <span
              className={
                toast.kind === "success"
                  ? "mt-0.5 text-[var(--an-success)]"
                  : "mt-0.5 text-[var(--an-danger)]"
              }
            >
              {toast.kind === "success" ? (
                <CheckCircle2 size={16} />
              ) : (
                <XCircle size={16} />
              )}
            </span>
            <p className="min-w-0 flex-1 text-[12px] leading-relaxed">
              {toast.message}
            </p>
            <button
              type="button"
              className="an-icon-btn -mr-1 -mt-1 h-6 w-6"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
            >
              <X size={13} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
