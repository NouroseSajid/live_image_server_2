"use client";

import { useEffect, useRef, useState } from "react";
import { FiEye, FiEyeOff, FiLock, FiSave, FiUnlock, FiX } from "react-icons/fi";
import axios from "axios";

interface FolderEditorModalProps {
  folder: {
    id: string;
    name: string;
    uniqueUrl: string;
    isPrivate: boolean;
    visible: boolean;
    passphrase: string | null;
    inGridView: boolean;
    folderThumbnailId?: string | null;
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: folder.name,
    uniqueUrl: folder.uniqueUrl,
    isPrivate: folder.isPrivate,
    visible: folder.visible,
    passphrase: folder.passphrase || "",
    inGridView: folder.inGridView,
  });

  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [thumbnailUploading, setThumbnailUploading] = useState(false);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [accessLinkToken, setAccessLinkToken] = useState<string | null>(null);
  const [isGeneratingAccessLink, setIsGeneratingAccessLink] = useState(false);

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

  const handleThumbnailSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setThumbnailFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setThumbnailPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setIsDirty(true);
    }
  };

  const handleThumbnailUpload = async () => {
    if (!thumbnailFile) return;

    try {
      setThumbnailUploading(true);
      setError(null);

      const formDataToSend = new FormData();
      formDataToSend.append("file", thumbnailFile);

      const res = await axios.post(
        `/api/folders/${folder.id}/thumbnail`,
        formDataToSend,
      );

      // Clear the thumbnail state
      setThumbnailFile(null);
      setThumbnailPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to upload thumbnail";
      setError(message);
    } finally {
      setThumbnailUploading(false);
    }
  };

  const getOrigin = () =>
    typeof window !== "undefined" ? window.location.origin : "";

  const buildAccessLinkUrl = (token: string) =>
    `${getOrigin()}/?t=${encodeURIComponent(token)}`;

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      setError("Failed to copy link");
      console.error("Clipboard copy failed:", err);
    }
  };

  const generateAccessLink = async () => {
    setIsGeneratingAccessLink(true);
    setError(null);
    try {
      const res = await fetch("/api/access-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: folder.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to create access link");
      }
      const link = await res.json();
      if (link?.token) {
        setAccessLinkToken(link.token);
        await copyToClipboard(buildAccessLinkUrl(link.token));
      } else {
        setError("No token returned");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create access link");
    } finally {
      setIsGeneratingAccessLink(false);
    }
  };

  // Warn before closing if form has unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && !isLoading && !thumbnailUploading) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, isLoading, thumbnailUploading]);

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
            disabled={isLoading || thumbnailUploading}
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

            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Access Link
              </p>
              {accessLinkToken ? (
                <div className="text-xs text-gray-600 dark:text-gray-400 break-all">
                  {buildAccessLinkUrl(accessLinkToken)}
                </div>
              ) : (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Generate a one-time access link for this folder.
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={generateAccessLink}
                  disabled={isGeneratingAccessLink}
                  className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600"
                >
                  {isGeneratingAccessLink ? "Generating…" : "Generate Access Link"}
                </button>
                {accessLinkToken && (
                  <button
                    type="button"
                    onClick={() => copyToClipboard(buildAccessLinkUrl(accessLinkToken))}
                    className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600"
                  >
                    Copy Access Link
                  </button>
                )}
              </div>
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
                type="text"
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
              Folder Thumbnail
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Upload Thumbnail Image (Optional)
              </label>
              <div className="flex flex-col gap-4">
                {/* File input */}
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleThumbnailSelect}
                    disabled={thumbnailUploading}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Image will be processed with the same variants as regular
                    uploads
                  </p>
                </div>

                {/* Preview */}
                {thumbnailPreview && (
                  <div className="relative w-full h-40 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                    <img
                      src={thumbnailPreview}
                      alt="Thumbnail preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {/* Upload button */}
                {thumbnailFile && (
                  <button
                    type="button"
                    onClick={handleThumbnailUpload}
                    disabled={thumbnailUploading}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-semibold transition-colors"
                  >
                    {thumbnailUploading ? "Uploading..." : "Upload Thumbnail"}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading || thumbnailUploading}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || thumbnailUploading}
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
