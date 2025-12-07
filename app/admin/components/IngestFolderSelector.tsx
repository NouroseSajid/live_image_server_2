"use client";

import type { Folder } from "@prisma/client";
import { useCallback, useEffect, useState } from "react";
import { useImageEvents } from "../../hooks/useImageEvents"; // Import the hook

export default function IngestFolderSelector() {
  const [folders, setFolders] = useState<Folder[]>([]);
  // Folder IDs are strings (cuid). Allow multiple selection.
  const [selectedFolderIds, setSelectedFolderIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Memoize the data fetching function
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch all folders
      const foldersRes = await fetch("/api/folders");
      if (!foldersRes.ok) {
        throw new Error("Failed to fetch folders.");
      }
      const foldersData = await foldersRes.json();
      console.log("[refreshData] Folders from API:", foldersData);
      setFolders(foldersData);

      // Fetch current ingest folder config
      const configRes = await fetch("/api/ingest-folder");
      if (!configRes.ok) {
        throw new Error("Failed to fetch ingest folder configuration.");
      }
      const configData = await configRes.json();
      console.log("[refreshData] Config from API:", configData);

      // The API may return { folderIds: [] } (new) or { folderId } (old).
      if (Array.isArray(configData.folderIds)) {
        // Only keep folder IDs that actually exist in the database
        const validIds = configData.folderIds.filter((id: string) =>
          foldersData.some((f: Folder) => f.id === id),
        );
        console.log("[refreshData] Valid folder IDs from config:", validIds);
        setSelectedFolderIds(validIds);

        // If some IDs were invalid, warn the user
        if (validIds.length < configData.folderIds.length) {
          setError(
            "⚠️ Some previously configured folders no longer exist. Please select valid folders and save again.",
          );
        }
      } else if (configData.folderId) {
        setSelectedFolderIds([String(configData.folderId)]);
      }
    } catch (err: any) {
      console.error("[refreshData] Error:", err);
      setError(err?.message ? String(err.message) : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []); // Empty dependency array means this function is created once

  useEffect(() => {
    refreshData();
  }, [refreshData]); // Depend on refreshData to ensure it's called on mount

  // Use the image events hook to refresh data on image updates
  useImageEvents({
    onImageUpdate: () => {
      console.log("Image update event received, refreshing data...");
      refreshData();
    },
    onError: (err) => {
      console.error("SSE Error:", err);
      setError("Failed to connect to image events. Data might not be live.");
    },
  });

  const _handleSelectionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const values = Array.from(e.target.selectedOptions).map((o) => o.value);
    setSelectedFolderIds(values);
  };

  const toggleFolder = (id: string) => {
    console.log(`[UI] Toggling folder: ${id}`);
    setSelectedFolderIds((prev) => {
      const updated = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      console.log(`[UI] Selected folder IDs:`, updated);
      return updated;
    });
  };

  const handleSaveChanges = async () => {
    console.log(
      `[UI] Save button clicked. Selected folders:`,
      selectedFolderIds,
    );

    if (!selectedFolderIds || selectedFolderIds.length === 0) {
      const msg = "Please select at least one folder.";
      console.warn(`[UI] ${msg}`);
      setError(msg);
      return;
    }

    setIsSaving(true);
    try {
      setError(null);
      setSuccessMessage(null);

      console.log(`[API] Sending POST to /api/ingest-folder with:`, {
        folderIds: selectedFolderIds,
      });

      const res = await fetch("/api/ingest-folder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ folderIds: selectedFolderIds }),
      });

      console.log(`[API] Response status: ${res.status}`);
      const responseData = await res.json();
      console.log(`[API] Response data:`, responseData);

      if (!res.ok) {
        console.error(`[API] Error response:`, responseData);
        throw new Error(
          responseData.error ||
            `Failed to update ingest folder (${res.status}).`,
        );
      }

      console.log(`[API] Success! Response:`, responseData);
      setSuccessMessage(
        `✅ Ingest folder updated! ${selectedFolderIds.length} folder${selectedFolderIds.length !== 1 ? "s" : ""} selected.`,
      );

      // Broadcast the config update to the WebSocket server so the watcher picks it up
      try {
        console.log(`[WS] Opening connection to broadcast config update...`);
        const ws = new WebSocket("ws://localhost:8080");

        const wsTimeout = setTimeout(() => {
          console.error("[WS] Connection timeout (5s)");
          ws.close();
        }, 5000);

        ws.onopen = () => {
          clearTimeout(wsTimeout);
          const msg = JSON.stringify({
            type: "ingest-config-update",
            folderIds: selectedFolderIds,
          });
          ws.send(msg);
          console.log("[WS] ✅ Sent ingest-config-update to watcher");
          ws.close();
        };

        ws.onerror = (err: any) => {
          clearTimeout(wsTimeout);
          console.error("[WS] ❌ Connection error:", err);
        };
      } catch (wsErr: any) {
        console.error("[WS] ❌ WebSocket error:", wsErr);
      }
    } catch (err: any) {
      console.error("[UI] ❌ Error saving ingest folder:", err);
      setError(err?.message ? String(err.message) : String(err));
    } finally {
      setIsSaving(false);
      // After saving changes, refresh the data to reflect any potential changes
      refreshData();
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm dark:bg-gray-800">
      <h2 className="mb-2 text-lg font-semibold">Ingest Destination Folder</h2>
      <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        Choose which folder new images from the ingest directory will be added
        to.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          ❌ {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          {successMessage}
        </div>
      )}

      {isLoading ? (
        <div className="text-gray-500">Loading folders...</div>
      ) : (
        <div className="flex items-start gap-4">
          <div className="flex-1 max-h-56 overflow-auto border rounded p-3 bg-gray-50 dark:bg-gray-700">
            <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              {folders.length === 0
                ? "No folders available"
                : "Select one or more folders"}
            </p>
            <div className="grid grid-cols-1 gap-2">
              {folders.map((folder) => (
                <label
                  key={folder.id}
                  className="flex items-center space-x-2 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedFolderIds.includes(folder.id)}
                    onChange={() => toggleFolder(folder.id)}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <span className="text-sm">{folder.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleSaveChanges}
              disabled={isSaving || selectedFolderIds.length === 0}
              className={`px-4 py-2 text-sm font-medium text-white rounded-md shadow-sm transition ${
                isSaving || selectedFolderIds.length === 0
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              }`}
            >
              {isSaving ? "Saving..." : "Save"}
            </button>

            {selectedFolderIds.length > 0 && (
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {selectedFolderIds.length} folder
                {selectedFolderIds.length !== 1 ? "s" : ""} selected
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
