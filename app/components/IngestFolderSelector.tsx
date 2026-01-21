"use client";

import { useEffect, useState } from "react";
import { FiCheckCircle, FiSettings, FiXCircle } from "react-icons/fi";

interface IngestFolderProps {
  folders: Array<{ id: string; name: string }>;
}

export default function IngestFolderSelector({ folders }: IngestFolderProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
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
      setSuccess(null);

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
      setSuccess("Ingest folder configured successfully");
      setTimeout(() => setSuccess(null), 3000);
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
    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <FiSettings
          className="text-indigo-600 dark:text-indigo-400"
          size={24}
        />
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
          Ingest Folder Configuration
        </h3>
        {isConfigured && (
          <div className="flex items-center gap-1 ml-auto text-green-600 dark:text-green-400">
            <FiCheckCircle size={18} />
            <span className="text-sm font-medium">Active</span>
          </div>
        )}
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        Select which folder will receive files from the ingest watcher. Files
        dropped in{" "}
        <code className="bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded text-xs">
          public/ingest
        </code>{" "}
        will be processed and added here.
      </p>

      <div className="space-y-4">
        {/* Folder Selection Dropdown */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Target Folder for Ingest
          </label>
          <select
            value={selectedFolderId || ""}
            onChange={(e) => setSelectedFolderId(e.target.value || null)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="">-- Select a folder --</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </div>

        {/* Current Configuration Display */}
        {isConfigured && selectedFolderName && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 flex items-center gap-2">
            <FiCheckCircle
              className="text-green-600 dark:text-green-400"
              size={18}
            />
            <div>
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                Currently ingesting to:{" "}
                <span className="font-bold">{selectedFolderName}</span>
              </p>
              <p className="text-xs text-green-700 dark:text-green-300">
                The ingest watcher will process all new files to this folder
              </p>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 flex items-center gap-2">
            <FiXCircle className="text-red-600 dark:text-red-400" size={18} />
            <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Success Display */}
        {success && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
            <p className="text-sm text-green-700 dark:text-green-200">
              {success}
            </p>
          </div>
        )}

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={loading || !selectedFolderId}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
        >
          {loading ? "Saving..." : "Configure Ingest Folder"}
        </button>

        {/* Info Section */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <p className="text-xs text-blue-800 dark:text-blue-200">
            <strong>💡 Tip:</strong> Once configured, start the ingest watcher
            with{" "}
            <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">
              npm run ingest
            </code>{" "}
            and drop image/video files in the{" "}
            <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">
              public/ingest
            </code>{" "}
            folder. They'll be automatically processed with variants!
          </p>
        </div>
      </div>
    </div>
  );
}
