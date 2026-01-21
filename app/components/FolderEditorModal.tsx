"use client";

import { useEffect, useRef, useState } from "react";
import { FiEye, FiEyeOff, FiLock, FiSave, FiUnlock, FiX } from "react-icons/fi";

interface FolderEditorModalProps {
  folder: {
    id: string;
    name: string;
    uniqueUrl: string;
    isPrivate: boolean;
    visible: boolean;
    passphrase: string | null;
    inGridView: boolean;
    folderThumb: string | null;
  };
  onClose: () => void;
  onSave: (updated: Partial<Folder>) => Promise<void>;
  isLoading: boolean;
}

export default function FolderEditorModal({
  folder,
  onClose,
  onSave,
  isLoading,
}: FolderEditorModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [formData, setFormData] = useState({
    name: folder.name,
    uniqueUrl: folder.uniqueUrl,
    isPrivate: folder.isPrivate,
    visible: folder.visible,
    passphrase: folder.passphrase || "",
    inGridView: folder.inGridView,
    folderThumb: folder.folderThumb || "",
  });

  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Focus on close button for accessibility
  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
    setIsDirty(true);
  };

  // Warn before closing if form has unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && !isLoading) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError("Folder name is required");
      return;
    }

    if (!formData.uniqueUrl.trim()) {
      setError("URL slug is required");
      return;
    }

    // Validate URL slug format (alphanumeric, hyphens, underscores only)
    const slugRegex = /^[a-zA-Z0-9_-]+$/;
    if (!slugRegex.test(formData.uniqueUrl)) {
      setError(
        "URL slug can only contain letters, numbers, hyphens, and underscores",
      );
      return;
    }

    // Warn about destructive changes
    if (formData.isPrivate !== folder.isPrivate && formData.isPrivate) {
      const confirmed = window.confirm(
        "Making this folder private will restrict access. Continue?",
      );
      if (!confirmed) return;
    }

    if (formData.visible !== folder.visible && !formData.visible) {
      const confirmed = window.confirm(
        "Hiding this folder will remove it from public galleries. Continue?",
      );
      if (!confirmed) return;
    }

    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="folder-edit-title"
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between">
          <h2
            id="folder-edit-title"
            className="text-2xl font-bold text-gray-900 dark:text-white"
          >
            Edit Folder
          </h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-50"
            aria-label="Close modal"
          >
            <FiX size={24} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-200">
              {error}
            </div>
          )}

          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Basic Information
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Folder Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                The display name of your folder
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Unique URL Slug
              </label>
              <input
                type="text"
                name="uniqueUrl"
                value={formData.uniqueUrl}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Used for share links and URLs
              </p>
            </div>
          </div>

          {/* Visibility & Access */}
          <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Visibility & Access
            </h3>

            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                <input
                  type="checkbox"
                  name="visible"
                  checked={formData.visible}
                  onChange={handleChange}
                  className="w-4 h-4"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {formData.visible ? (
                      <FiEye size={16} className="text-blue-500" />
                    ) : (
                      <FiEyeOff size={16} className="text-gray-500" />
                    )}
                    <span className="font-medium text-gray-900 dark:text-white">
                      Visible
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Show this folder in public galleries
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                <input
                  type="checkbox"
                  name="isPrivate"
                  checked={formData.isPrivate}
                  onChange={handleChange}
                  className="w-4 h-4"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {formData.isPrivate ? (
                      <FiLock size={16} className="text-orange-500" />
                    ) : (
                      <FiUnlock size={16} className="text-gray-500" />
                    )}
                    <span className="font-medium text-gray-900 dark:text-white">
                      Private
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Restrict access to authenticated users
                  </p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors">
                <input
                  type="checkbox"
                  name="inGridView"
                  checked={formData.inGridView}
                  onChange={handleChange}
                  className="w-4 h-4"
                />
                <div className="flex-1">
                  <span className="font-medium text-gray-900 dark:text-white">
                    Show in Gallery
                  </span>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Display images on main gallery/homepage
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Security */}
          <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Security
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Access Passphrase (Optional)
              </label>
              <input
                type="password"
                name="passphrase"
                value={formData.passphrase}
                onChange={handleChange}
                placeholder="Leave empty for no passphrase"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Visitors must enter this passphrase to view the folder
              </p>
            </div>
          </div>

          {/* Thumbnail */}
          <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Thumbnail
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Folder Thumbnail URL (Optional)
              </label>
              <textarea
                name="folderThumb"
                value={formData.folderThumb}
                onChange={handleChange}
                placeholder="Path to folder thumbnail image"
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Image to display as folder thumbnail in galleries
              </p>
            </div>
          </div>

          {/* Buttons */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-semibold flex items-center justify-center gap-2"
            >
              <FiSave size={18} />
              {isLoading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
