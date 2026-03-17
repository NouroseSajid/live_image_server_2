"use client";

import { UploadCloud, X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

interface UploadPreviewModalProps {
  files: File[];
  onConfirm: () => void;
  onCancel: () => void;
  onRemove: (index: number) => void;
}

function fileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

export default function UploadPreviewModal({
  files,
  onConfirm,
  onCancel,
  onRemove,
}: UploadPreviewModalProps) {
  const blobUrls = useRef<Map<string, string>>(new Map());

  // Close on Escape
  useEffect(() => {
    if (files.length === 0) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [files.length, onCancel]);

  // Build URLs keyed by file identity, revoke stale ones
  const urls = useMemo(() => {
    const activeKeys = new Set(files.map(fileKey));
    // Revoke URLs for removed files
    for (const [key, url] of blobUrls.current) {
      if (!activeKeys.has(key)) {
        URL.revokeObjectURL(url);
        blobUrls.current.delete(key);
      }
    }
    // Create URLs for new files
    const result = new Map<string, string>();
    for (const file of files) {
      const k = fileKey(file);
      if (!blobUrls.current.has(k)) {
        blobUrls.current.set(k, URL.createObjectURL(file));
      }
      result.set(k, blobUrls.current.get(k)!);
    }
    return result;
  }, [files]);

  // Revoke all on unmount
  useEffect(() => {
    return () => {
      for (const url of blobUrls.current.values()) {
        URL.revokeObjectURL(url);
      }
      blobUrls.current.clear();
    };
  }, []);

  if (files.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Upload {files.length} file{files.length !== 1 ? "s" : ""}?
          </h3>
          <button
            onClick={onCancel}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
          >
            <X size={20} />
          </button>
        </div>

        {/* Thumbnails grid */}
        <div className="overflow-y-auto p-4 flex-1">
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {files.map((file, i) => {
              const k = fileKey(file);
              return (
                <div key={k} className="relative group">
                  <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                    {file.type.startsWith("image/") ? (
                      <img
                        src={urls.get(k)}
                        alt={file.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <UploadCloud size={28} />
                        <span className="text-xs mt-1 truncate max-w-full px-1">
                          {file.name.split(".").pop()?.toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Remove button */}
                  <button
                    onClick={() => onRemove(i)}
                    className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow"
                  >
                    <X size={14} />
                  </button>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-1">
                    {file.name}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-2"
          >
            <UploadCloud size={16} />
            Upload {files.length} file{files.length !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}
