"use client";

import { useEffect, useState } from "react";
import { FiCheckCircle, FiXCircle } from "react-icons/fi";

interface IngestFolderProps {
  folders: Array<{ id: string; name: string }>;
}

export default function IngestFolderSelector({ folders }: IngestFolderProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);

  // Load current config on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch("/api/ingest-config");
        const config = await res.json();
        if (config.folderId) {
          setSelectedFolderId(config.folderId);
          setIsConfigured(true);
        }
      } catch (err) {
        console.error("Error loading ingest config:", err);
      }
    };
    loadConfig();
  }, []);

  const handleSave = async () => {
    if (!selectedFolderId) {
      setError("Please select a folder");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/ingest-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: selectedFolderId }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to save config");
      }

      setIsConfigured(true);
      setTimeout(() => setError(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving config");
    } finally {
      setLoading(false);
    }
  };

  const selectedFolderName = folders.find(
    (f) => f.id === selectedFolderId,
  )?.name;

  return (
    <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Ingest Target
          </label>
          <select
            value={selectedFolderId || ""}
            onChange={(e) => setSelectedFolderId(e.target.value || null)}
            disabled={loading}
            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Select folder...</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleSave}
          disabled={loading || !selectedFolderId}
          className="px-3 py-2 mt-6 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded transition-colors"
        >
          {loading ? "..." : "Save"}
        </button>

        {isConfigured && (
          <div className="mt-6 text-green-600 dark:text-green-400">
            <FiCheckCircle size={18} />
          </div>
        )}

        {error && (
          <div className="mt-6 text-red-600 dark:text-red-400">
            <FiXCircle size={18} title={error} />
          </div>
        )}
      </div>

      {selectedFolderName && isConfigured && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Ingesting to: <span className="font-medium">{selectedFolderName}</span>
        </p>
      )}
    </div>
  );
}
