"use client";

import { useEffect, useState } from "react";

interface Folder {
  id: string;
  name: string;
  isPrivate: boolean;
  visible: boolean;
  uniqueUrl: string;
  passphrase: string | null;
  inGridView: boolean;
  folderThumb: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function AdminFolders() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [newFolder, setNewFolder] = useState({
    name: "",
    isPrivate: true,
    visible: true,
    uniqueUrl: "",
    passphrase: "",
    inGridView: false,
    folderThumb: "",
  });
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [creating, setCreating] = useState(false);
  const [_updating, setUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [generatingLinkId, setGeneratingLinkId] = useState<string | null>(null);
  const [accessLinks, setAccessLinks] = useState<Record<string, string>>({});
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);

  const getOrigin = () =>
    typeof window !== "undefined" ? window.location.origin : "";

  const buildShareLinks = (folder: Folder) => {
    const base = `${getOrigin()}/f/${encodeURIComponent(folder.uniqueUrl)}`;
    const unlocked = folder.passphrase
      ? `${base}?p=${encodeURIComponent(folder.passphrase)}`
      : base;
    return { base, unlocked };
  };

  const buildAccessLinkUrl = (token: string) =>
    `${getOrigin()}/?t=${encodeURIComponent(token)}`;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setStatusMessage({ type: "success", text: "Link copied" });
    } catch {
      setStatusMessage({ type: "error", text: "Failed to copy link" });
    }
  };

  const generateAccessLink = async (folderId: string) => {
    setGeneratingLinkId(folderId);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/access-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to create access link");
      }
      const link = await res.json();
      if (link?.token) {
        setAccessLinks((prev) => ({ ...prev, [folderId]: link.token }));
        await copyToClipboard(buildAccessLinkUrl(link.token));
      } else {
        setStatusMessage({ type: "error", text: "No token returned" });
      }
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to create access link",
      });
    } finally {
      setGeneratingLinkId(null);
    }
  };

  const fetchFolders = async () => {
    const res = await fetch("/api/folders");
    if (res.ok) {
      const data = await res.json();
      setFolders(data);
    } else {
      console.error("Failed to fetch folders");
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);
    if (!newFolder.name || !newFolder.name.trim()) {
      setStatusMessage({ type: "error", text: "Name is required" });
      return;
    }
    setCreating(true);
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(newFolder),
    });
    if (res.ok) {
      const created = await res.json();
      setStatusMessage({
        type: "success",
        text: `Folder "${created.name}" created`,
      });
      setNewFolder({
        name: "",
        isPrivate: true,
        visible: true,
        uniqueUrl: "",
        passphrase: "",
        inGridView: false,
        folderThumb: "",
      });
      await fetchFolders();
    } else {
      let errText = "Failed to create folder";
      try {
        const err = await res.json();
        if (err?.error) errText = err.error;
      } catch {
        const text = await res.text();
        if (text) errText = text;
      }
      setStatusMessage({ type: "error", text: errText });
    }
    setCreating(false);
  };

  const handleUpdateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFolder) return;
    setStatusMessage(null);
    if (!editingFolder.name || !editingFolder.name.trim()) {
      setStatusMessage({ type: "error", text: "Name is required" });
      return;
    }
    setUpdating(true);

    const res = await fetch(`/api/folders/${editingFolder.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(editingFolder),
    });
    if (res.ok) {
      setEditingFolder(null);
      fetchFolders();
    } else {
      let errText = "Failed to update folder";
      try {
        const err = await res.json();
        if (err?.error) errText = err.error;
      } catch {
        const text = await res.text();
        if (text) errText = text;
      }
      setStatusMessage({ type: "error", text: errText });
    }
    setUpdating(false);
  };

  const handleDeleteFolder = async (id: string) => {
    setStatusMessage(null);
    setDeletingId(id);
    const res = await fetch(`/api/folders/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      setStatusMessage({ type: "success", text: "Folder deleted" });
      await fetchFolders();
    } else {
      let errText = "Failed to delete folder";
      try {
        const err = await res.json();
        if (err?.error) errText = err.error;
      } catch {
        const text = await res.text();
        if (text) errText = text;
      }
      setStatusMessage({ type: "error", text: errText });
    }
    setDeletingId(null);
  };

  return (
    <div
      className="admin-theme p-6"
      style={{
        backgroundColor: "var(--admin-background)",
        color: "var(--admin-text)",
      }}
    >
      <h1 className="text-2xl font-semibold mb-4">Folder Management</h1>

      <section className="mb-8">
        <h2 className="text-xl font-medium mb-3">Create New Folder</h2>
        {statusMessage && (
          <div
            className={`mb-3 p-2 rounded ${statusMessage.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
          >
            {statusMessage.text}
          </div>
        )}
        <form
          onSubmit={handleCreateFolder}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl"
        >
          <input
            className="border rounded px-3 py-2"
            style={{
              backgroundColor: "var(--admin-card)",
              color: "var(--admin-text)",
              borderColor: "var(--admin-border)",
            }}
            type="text"
            placeholder="Name"
            value={newFolder.name}
            onChange={(e) =>
              setNewFolder({ ...newFolder, name: e.target.value })
            }
          />
          <input
            className="border rounded px-3 py-2"
            style={{
              backgroundColor: "var(--admin-card)",
              color: "var(--admin-text)",
              borderColor: "var(--admin-border)",
            }}
            type="text"
            placeholder="Unique URL"
            value={newFolder.uniqueUrl}
            onChange={(e) =>
              setNewFolder({ ...newFolder, uniqueUrl: e.target.value })
            }
          />

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={newFolder.isPrivate}
              onChange={(e) =>
                setNewFolder({ ...newFolder, isPrivate: e.target.checked })
              }
            />
            <span>Is Private</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={newFolder.visible}
              onChange={(e) =>
                setNewFolder({ ...newFolder, visible: e.target.checked })
              }
            />
            <span>Visible</span>
          </label>

          <input
            className="border rounded px-3 py-2 md:col-span-2"
            style={{
              backgroundColor: "var(--admin-card)",
              color: "var(--admin-text)",
              borderColor: "var(--admin-border)",
            }}
            type="text"
            placeholder="Passphrase (optional)"
            value={newFolder.passphrase || ""}
            onChange={(e) =>
              setNewFolder({ ...newFolder, passphrase: e.target.value })
            }
          />

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={newFolder.inGridView}
              onChange={(e) =>
                setNewFolder({ ...newFolder, inGridView: e.target.checked })
              }
            />
            <span>In Grid View</span>
          </label>

          <input
            className="border rounded px-3 py-2 md:col-span-2"
            style={{
              backgroundColor: "var(--admin-card)",
              color: "var(--admin-text)",
              borderColor: "var(--admin-border)",
            }}
            type="text"
            placeholder="Folder Thumbnail URL (optional)"
            value={newFolder.folderThumb || ""}
            onChange={(e) =>
              setNewFolder({ ...newFolder, folderThumb: e.target.value })
            }
          />

          <div className="md:col-span-2">
            <button
              type="submit"
              className="px-4 py-2 rounded"
              style={{
                backgroundColor: "var(--admin-primary)",
                color: "var(--admin-primary-foreground)",
              }}
              disabled={creating}
            >
              {creating ? "Creating…" : "Create Folder"}
            </button>
          </div>
        </form>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-medium mb-3">Existing Folders</h2>
        <ul className="space-y-2 max-w-3xl">
          {folders.map((folder) => (
            <li
              key={folder.id}
              className="flex items-center justify-between gap-4 p-3 rounded"
              style={{ backgroundColor: "var(--admin-card)" }}
            >
              <div>
                <div className="font-medium">{folder.name}</div>
                <div className="text-sm text-muted-foreground">
                  {folder.uniqueUrl}
                </div>
                <div className="text-xs text-muted-foreground">
                  Passphrase: {folder.passphrase || "(none)"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Share: {buildShareLinks(folder).base}
                </div>
                {folder.passphrase && (
                  <div className="text-xs text-muted-foreground">
                    Unlocked: {buildShareLinks(folder).unlocked}
                  </div>
                )}
                {accessLinks[folder.id] && (
                  <div className="text-xs text-muted-foreground">
                    Access link: {buildAccessLinkUrl(accessLinks[folder.id])}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="px-2 py-1 rounded border"
                  onClick={() => generateAccessLink(folder.id)}
                  style={{ borderColor: "var(--admin-border)" }}
                  disabled={generatingLinkId === folder.id}
                >
                  {generatingLinkId === folder.id
                    ? "Generating…"
                    : "Access Link"}
                </button>
                {accessLinks[folder.id] && (
                  <button
                    type="button"
                    className="px-2 py-1 rounded border"
                    onClick={() =>
                      copyToClipboard(
                        buildAccessLinkUrl(accessLinks[folder.id]),
                      )
                    }
                    style={{ borderColor: "var(--admin-border)" }}
                  >
                    Copy Access Link
                  </button>
                )}
                <button
                  type="button"
                  className="px-2 py-1 rounded border"
                  onClick={() => copyToClipboard(buildShareLinks(folder).base)}
                  style={{ borderColor: "var(--admin-border)" }}
                >
                  Copy Link
                </button>
                {folder.passphrase && (
                  <button
                    type="button"
                    className="px-2 py-1 rounded border"
                    onClick={() =>
                      copyToClipboard(buildShareLinks(folder).unlocked)
                    }
                    style={{ borderColor: "var(--admin-border)" }}
                  >
                    Copy Unlocked
                  </button>
                )}
                <button
                  type="button"
                  className="px-2 py-1 rounded border"
                  onClick={() => setEditingFolder(folder)}
                  style={{ borderColor: "var(--admin-border)" }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="px-2 py-1 rounded border text-red-600"
                  onClick={() => handleDeleteFolder(folder.id)}
                  style={{ borderColor: "var(--admin-border)" }}
                  disabled={deletingId === folder.id}
                >
                  {deletingId === folder.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {editingFolder && (
        <section className="mb-8 max-w-3xl">
          <h2 className="text-xl font-medium mb-3">Edit Folder</h2>
          <form
            onSubmit={handleUpdateFolder}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            <input
              className="border rounded px-3 py-2"
              style={{
                backgroundColor: "var(--admin-card)",
                color: "var(--admin-text)",
                borderColor: "var(--admin-border)",
              }}
              type="text"
              placeholder="Name"
              value={editingFolder.name}
              onChange={(e) =>
                setEditingFolder({ ...editingFolder, name: e.target.value })
              }
            />
            <input
              className="border rounded px-3 py-2"
              style={{
                backgroundColor: "var(--admin-card)",
                color: "var(--admin-text)",
                borderColor: "var(--admin-border)",
              }}
              type="text"
              placeholder="Unique URL"
              value={editingFolder.uniqueUrl}
              onChange={(e) =>
                setEditingFolder({
                  ...editingFolder,
                  uniqueUrl: e.target.value,
                })
              }
            />
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editingFolder.isPrivate}
                onChange={(e) =>
                  setEditingFolder({
                    ...editingFolder,
                    isPrivate: e.target.checked,
                  })
                }
              />
              <span>Is Private</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editingFolder.visible}
                onChange={(e) =>
                  setEditingFolder({
                    ...editingFolder,
                    visible: e.target.checked,
                  })
                }
              />
              <span>Visible</span>
            </label>
            <input
              className="border rounded px-3 py-2 md:col-span-2"
              style={{
                backgroundColor: "var(--admin-card)",
                color: "var(--admin-text)",
                borderColor: "var(--admin-border)",
              }}
              type="text"
              placeholder="Passphrase (optional)"
              value={editingFolder.passphrase || ""}
              onChange={(e) =>
                setEditingFolder({
                  ...editingFolder,
                  passphrase: e.target.value,
                })
              }
            />
            <div className="md:col-span-2 text-sm text-muted-foreground">
              Share link: {buildShareLinks(editingFolder).base}
            </div>
            {editingFolder.passphrase && (
              <div className="md:col-span-2 text-sm text-muted-foreground">
                Unlocked link: {buildShareLinks(editingFolder).unlocked}
              </div>
            )}
            {accessLinks[editingFolder.id] && (
              <div className="md:col-span-2 text-sm text-muted-foreground">
                Access link: {buildAccessLinkUrl(accessLinks[editingFolder.id])}
              </div>
            )}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editingFolder.inGridView}
                onChange={(e) =>
                  setEditingFolder({
                    ...editingFolder,
                    inGridView: e.target.checked,
                  })
                }
              />
              <span>In Grid View</span>
            </label>
            <input
              className="border rounded px-3 py-2 md:col-span-2"
              style={{
                backgroundColor: "var(--admin-card)",
                color: "var(--admin-text)",
                borderColor: "var(--admin-border)",
              }}
              type="text"
              placeholder="Folder Thumbnail URL (optional)"
              value={editingFolder.folderThumb || ""}
              onChange={(e) =>
                setEditingFolder({
                  ...editingFolder,
                  folderThumb: e.target.value,
                })
              }
            />

            <div className="md:col-span-2 flex gap-2">
              <button
                type="button"
                className="px-3 py-2 rounded border"
                onClick={() => generateAccessLink(editingFolder.id)}
                style={{ borderColor: "var(--admin-border)" }}
                disabled={generatingLinkId === editingFolder.id}
              >
                {generatingLinkId === editingFolder.id
                  ? "Generating…"
                  : "Generate Access Link"}
              </button>
              {accessLinks[editingFolder.id] && (
                <button
                  type="button"
                  className="px-3 py-2 rounded border"
                  onClick={() =>
                    copyToClipboard(
                      buildAccessLinkUrl(accessLinks[editingFolder.id]),
                    )
                  }
                  style={{ borderColor: "var(--admin-border)" }}
                >
                  Copy Access Link
                </button>
              )}
            </div>

            <div className="md:col-span-2 flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 rounded"
                style={{
                  backgroundColor: "var(--admin-primary)",
                  color: "var(--admin-primary-foreground)",
                }}
              >
                Save Changes
              </button>
              <button
                type="button"
                onClick={() => setEditingFolder(null)}
                className="px-4 py-2 rounded border"
                style={{ borderColor: "var(--admin-border)" }}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
