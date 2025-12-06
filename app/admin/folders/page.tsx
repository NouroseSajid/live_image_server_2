"use client";

import { useEffect, useState } from "react";
import AdminFolderImageGallery from "./components/AdminFolderImageGallery";
import ThumbnailUploader from "./components/ThumbnailUploader";

interface FileVariant {
  id: string;
  name: string;
  width?: number;
  height?: number;
  size: bigint;
  path: string;
  codec?: string;
  fileId: string;
}

interface File {
  id: string;
  fileName: string;
  hash: string;
  width?: number;
  height?: number;
  duration?: number;
  fileSize: bigint;
  fileType: "image" | "video";
  isLive: boolean;
  rotation?: number;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  folderId: string;
  variants: FileVariant[];
}

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
  files: File[]; // Add files array to Folder interface
}

export default function AdminFolders() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [newFolder, setNewFolder] = useState({
    name: "",
    isPrivate: true,
    visible: true,
    passphrase: "",
    inGridView: false,
    folderThumb: "",
  });
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedFolderForUpload, setSelectedFolderForUpload] = useState<
    string | null
  >(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatusMessage, setUploadStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{
    [fileName: string]: number;
  }>({});

  useEffect(() => {
    fetchFolders();
  }, []);

  const fetchFolders = async () => {
    const res = await fetch("/api/folders");
    if (res.ok) {
      const data = await res.json();
      setFolders(data);
      if (data.length > 0 && !selectedFolderForUpload) {
        setSelectedFolderForUpload(data[0].id); // Select the first folder by default
      }
    } else {
      console.error("Failed to fetch folders");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMessage(null);

    const folderToProcess = editingFolder || newFolder;

    if (!folderToProcess.name || !folderToProcess.name.trim()) {
      setStatusMessage({ type: "error", text: "Name is required" });
      return;
    }

    if (editingFolder) {
      setUpdating(true);
      const res = await fetch(`/api/folders/${editingFolder.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(folderToProcess),
      });
      if (res.ok) {
        setStatusMessage({
          type: "success",
          text: `Folder "${folderToProcess.name}" updated`,
        });
        setEditingFolder(null);
        await fetchFolders();
      } else {
        let errText = "Failed to update folder";
        try {
          const err = await res.json();
          if (err && err.error) errText = err.error;
        } catch {
          const text = await res.text();
          if (text) errText = text;
        }
        setStatusMessage({ type: "error", text: errText });
      }
      setUpdating(false);
    } else {
      setCreating(true);
      const res = await fetch("/api/folders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(folderToProcess),
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
          passphrase: "",
          inGridView: false,
          folderThumb: "",
        });
        await fetchFolders();
      } else {
        let errText = "Failed to create folder";
        try {
          const err = await res.json();
          if (err && err.error) errText = err.error;
        } catch {
          const text = await res.text();
          if (text) errText = text;
        }
        setStatusMessage({ type: "error", text: errText });
      }
      setCreating(false);
    }
  };

  const handleImageUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadStatusMessage(null);
    if (selectedFiles.length === 0 || !selectedFolderForUpload) {
      setUploadStatusMessage({
        type: "error",
        text: "Please select files and a target folder.",
      });
      return;
    }

    setUploading(true);
    setUploadProgress({});
    let successCount = 0;
    let errorCount = 0;

    const uploadPromises = selectedFiles.map((file) => {
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/upload", true);
        xhr.setRequestHeader("x-folder-id", selectedFolderForUpload as string);
        xhr.setRequestHeader("x-file-name", file.name);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            setUploadProgress((prev) => ({
              ...prev,
              [file.name]: percentComplete,
            }));
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            successCount++;
            resolve(xhr.response);
          } else {
            errorCount++;
            console.error(`Error uploading ${file.name}:`, xhr.responseText);
            reject(xhr.responseText);
          }
        };

        xhr.onerror = () => {
          errorCount++;
          console.error(`Error uploading ${file.name}:`, xhr.statusText);
          reject(xhr.statusText);
        };

        xhr.send(file);
      });
    });

    try {
      await Promise.all(uploadPromises);
    } catch (error) {
      // Errors are already logged in the xhr handlers
    }

    if (errorCount === 0) {
      setUploadStatusMessage({
        type: "success",
        text: `${successCount} files uploaded successfully!`,
      });
    } else {
      setUploadStatusMessage({
        type: "error",
        text: `Uploaded ${successCount} files, but ${errorCount} failed. See console for details.`,
      });
    }

    setSelectedFiles([]);
    fetchFolders();
    setUploading(false);
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
        if (err && err.error) errText = err.error;
      } catch {
        const text = await res.text();
        if (text) errText = text;
      }
      setStatusMessage({ type: "error", text: errText });
    }
    setDeletingId(null);
  };

  const handleEditFolder = async (folder: Folder) => {
    setStatusMessage(null);
    try {
      const res = await fetch(`/api/folders/${folder.id}`);
      if (res.ok) {
        const fullFolderData = await res.json();
        setEditingFolder(fullFolderData);
      } else {
        const errorText = await res.text();
        setStatusMessage({
          type: "error",
          text: `Failed to fetch folder details: ${errorText}`,
        });
      }
    } catch (error) {
      console.error("Error fetching folder details:", error);
      setStatusMessage({
        type: "error",
        text: "An unexpected error occurred while fetching folder details.",
      });
    }
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
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="px-2 py-1 rounded border"
                  onClick={() => handleEditFolder(folder)}
                  style={{ borderColor: "var(--admin-border)" }}
                >
                  Edit
                </button>
                <button
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

      <section className="mb-8">
        <h2 className="text-xl font-medium mb-3">
          {editingFolder ? "Edit Folder" : "Create New Folder"}
        </h2>
        {statusMessage && (
          <div
            className={`mb-3 p-2 rounded ${statusMessage.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
          >
            {statusMessage.text}
          </div>
        )}
        <form
          onSubmit={handleSubmit}
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
            value={editingFolder ? editingFolder.name : newFolder.name}
            onChange={(e) => {
              if (editingFolder) {
                setEditingFolder({ ...editingFolder, name: e.target.value });
              } else {
                setNewFolder({ ...newFolder, name: e.target.value });
              }
            }}
          />

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={
                editingFolder ? editingFolder.isPrivate : newFolder.isPrivate
              }
              onChange={(e) => {
                if (editingFolder) {
                  setEditingFolder({
                    ...editingFolder,
                    isPrivate: e.target.checked,
                  });
                } else {
                  setNewFolder({ ...newFolder, isPrivate: e.target.checked });
                }
              }}
            />
            <span>Is Private</span>
          </label>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={
                editingFolder ? editingFolder.visible : newFolder.visible
              }
              onChange={(e) => {
                if (editingFolder) {
                  setEditingFolder({
                    ...editingFolder,
                    visible: e.target.checked,
                  });
                } else {
                  setNewFolder({ ...newFolder, visible: e.target.checked });
                }
              }}
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
            value={
              editingFolder
                ? editingFolder.passphrase || ""
                : newFolder.passphrase || ""
            }
            onChange={(e) => {
              if (editingFolder) {
                setEditingFolder({
                  ...editingFolder,
                  passphrase: e.target.value,
                });
              } else {
                setNewFolder({ ...newFolder, passphrase: e.target.value });
              }
            }}
          />

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={
                editingFolder ? editingFolder.inGridView : newFolder.inGridView
              }
              onChange={(e) => {
                if (editingFolder) {
                  setEditingFolder({
                    ...editingFolder,
                    inGridView: e.target.checked,
                  });
                } else {
                  setNewFolder({ ...newFolder, inGridView: e.target.checked });
                }
              }}
            />
            <span>In Grid View</span>
          </label>

          {editingFolder && (
            <ThumbnailUploader
              folder={editingFolder}
              onThumbnailUpdate={(newThumbnailUrl) => {
                setEditingFolder({
                  ...editingFolder,
                  folderThumb: newThumbnailUrl,
                });
              }}
            />
          )}

          <div className="md:col-span-2 flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 rounded"
              style={{
                backgroundColor: "var(--admin-primary)",
                color: "var(--admin-primary-foreground)",
              }}
              disabled={creating || updating}
            >
              {editingFolder
                ? updating
                  ? "Saving…"
                  : "Save Changes"
                : creating
                  ? "Creating…"
                  : "Create Folder"}
            </button>
            {editingFolder && (
              <button
                type="button"
                onClick={() => setEditingFolder(null)}
                className="px-4 py-2 rounded border"
                style={{ borderColor: "var(--admin-border)" }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
        {editingFolder && (
          <>
            {console.log(
              "Rendering AdminFolderImageGallery with folder:",
              editingFolder,
            )}
            <AdminFolderImageGallery
              folder={editingFolder}
              onImageUpdate={() => handleEditFolder(editingFolder)}
            />
          </>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-medium mb-3">Upload Images</h2>
        {uploadStatusMessage && (
          <div
            className={`mb-3 p-2 rounded ${uploadStatusMessage.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
          >
            {uploadStatusMessage.text}
          </div>
        )}
        <form
          onSubmit={handleImageUpload}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl"
        >
          <input
            type="file"
            multiple
            onChange={(e) =>
              setSelectedFiles(e.target.files ? Array.from(e.target.files) : [])
            }
            className="col-span-2 border rounded px-3 py-2"
            style={{
              backgroundColor: "var(--admin-card)",
              color: "var(--admin-text)",
              borderColor: "var(--admin-border)",
            }}
          />
          {uploading && (
            <div className="col-span-2">
              {selectedFiles.map((file) => (
                <div key={file.name} className="mb-2">
                  <p className="text-sm font-medium">{file.name}</p>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full"
                      style={{ width: `${uploadProgress[file.name] || 0}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <select
            value={selectedFolderForUpload || ""}
            onChange={(e) => setSelectedFolderForUpload(e.target.value)}
            className="col-span-2 border rounded px-3 py-2"
            style={{
              backgroundColor: "var(--admin-card)",
              color: "var(--admin-text)",
              borderColor: "var(--admin-border)",
            }}
          >
            <option value="" disabled>
              Select a folder
            </option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="px-4 py-2 rounded"
              style={{
                backgroundColor: "var(--admin-primary)",
                color: "var(--admin-primary-foreground)",
              }}
              disabled={
                uploading ||
                selectedFiles.length === 0 ||
                !selectedFolderForUpload
              }
            >
              {uploading ? "Uploading…" : "Upload Images"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
