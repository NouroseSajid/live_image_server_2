"use client";

import { useEffect, useRef, useState } from "react";
import { FiArchive, FiEye, FiGrid, FiLink, FiLock, FiSave, FiX } from "react-icons/fi";
import axios from "axios";

export interface FolderUpdate {
  name: string;
  uniqueUrl: string;
  isPrivate: boolean;
  visible: boolean;
  archived: boolean;
  passphrase: string | null;
  inGridView: boolean;
  folderThumbnailId?: string | null;
  groupId?: string | null;
}

interface FolderEditorModalProps {
  folder: {
    id: string;
    name: string;
    uniqueUrl: string;
    isPrivate: boolean;
    visible: boolean;
    archived: boolean;
    passphrase: string | null;
    inGridView: boolean;
    folderThumbnailId?: string | null;
    groupId?: string | null;
  };
  groups: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSave: (updated: Partial<FolderUpdate>) => Promise<void>;
  isLoading: boolean;
}

export default function FolderEditorModal({
  folder,
  groups,
  onClose,
  onSave,
  isLoading,
}: FolderEditorModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const passphraseInputRef = useRef<HTMLInputElement>(null);
  const prevPrivateRef = useRef(folder.isPrivate);
  const [formData, setFormData] = useState({
    name: folder.name,
    uniqueUrl: folder.uniqueUrl,
    isPrivate: folder.isPrivate,
    visible: folder.visible,
    archived: folder.archived ?? false,
    passphrase: folder.passphrase || "",
    inGridView: folder.inGridView,
    groupId: folder.groupId || "",
  });

  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [thumbnailUploading, setThumbnailUploading] = useState(false);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);

  // Visibility slider: 0=Archived, 1=Hidden, 2=Visible, 3=In Gallery
  const VISIBILITY_LEVELS = [
    { label: "Archived", icon: FiArchive, color: "text-gray-500", desc: "Admin-only. Not accessible publicly." },
    { label: "Hidden", icon: FiLink, color: "text-yellow-500", desc: "Accessible via direct link only" },
    { label: "Visible", icon: FiEye, color: "text-blue-500", desc: "Shown in folder navigation" },
    { label: "In Gallery", icon: FiGrid, color: "text-green-500", desc: "Images appear in main gallery" },
  ] as const;

  const SLIDER_COLORS = ["#6b7280", "#eab308", "#3b82f6", "#22c55e"];

  const deriveSliderLevel = (data: { archived: boolean; visible: boolean; inGridView: boolean }) => {
    if (data.archived) return 0;
    if (!data.visible) return 1;
    if (data.inGridView) return 3;
    return 2;
  };

  const applySliderLevel = (level: number) => {
    const map = [
      { archived: true, visible: false, inGridView: false },
      { archived: false, visible: false, inGridView: false },
      { archived: false, visible: true, inGridView: false },
      { archived: false, visible: true, inGridView: true },
    ];
    setFormData((prev) => ({ ...prev, ...map[level] }));
    setIsDirty(true);
  };

  const visibilityLevel = deriveSliderLevel(formData);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [accessLinkToken, setAccessLinkToken] = useState<string | null>(null);
  const [isGeneratingAccessLink, setIsGeneratingAccessLink] = useState(false);

  // Focus on close button for accessibility
  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const wasPrivate = prevPrivateRef.current;
    prevPrivateRef.current = formData.isPrivate;
    if (!wasPrivate && formData.isPrivate && !formData.passphrase.trim()) {
      passphraseInputRef.current?.focus();
    }
  }, [formData.isPrivate, formData.passphrase]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
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

      const _res = await axios.post(
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

    if (formData.isPrivate && !formData.passphrase.trim()) {
      setError("Passphrase required when password protection is enabled.");
      passphraseInputRef.current?.focus();
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
      const payload = {
        ...formData,
        groupId: formData.groupId || null,
      };
      await onSave(payload);
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

            {/* Notched slider */}
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 space-y-4">
              {/* Current level indicator */}
              <div className="flex items-center gap-3">
                {(() => { const L = VISIBILITY_LEVELS[visibilityLevel]; const Icon = L.icon; return (
                  <>
                    <div className={`p-2 rounded-lg bg-gray-200 dark:bg-gray-600 ${L.color}`}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-white text-sm">{L.label}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{L.desc}</p>
                    </div>
                  </>
                ); })()}
              </div>

              {/* Slider track */}
              <div className="relative px-1">
                {/* Track background */}
                <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-600 relative">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all duration-200"
                    style={{
                      width: `${(visibilityLevel / 3) * 100}%`,
                      background: SLIDER_COLORS[visibilityLevel],
                    }}
                  />
                </div>

                {/* Notch buttons */}
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between">
                  {VISIBILITY_LEVELS.map((level, i) => (
                    <button
                      key={level.label}
                      type="button"
                      onClick={() => applySliderLevel(i)}
                      className={`w-5 h-5 rounded-full border-2 transition-all duration-200 flex items-center justify-center ${
                        i <= visibilityLevel
                          ? "border-current bg-white dark:bg-gray-800 shadow-md scale-110"
                          : "border-gray-300 dark:border-gray-500 bg-gray-100 dark:bg-gray-700"
                      }`}
                      style={i <= visibilityLevel ? { color: SLIDER_COLORS[i] } : undefined}
                      aria-label={level.label}
                    >
                      {i === visibilityLevel && (
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ background: SLIDER_COLORS[i] }}
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Labels below */}
              <div className="flex justify-between">
                {VISIBILITY_LEVELS.map((level, i) => (
                  <button
                    key={level.label}
                    type="button"
                    onClick={() => applySliderLevel(i)}
                    className={`text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                      i === visibilityLevel
                        ? "text-gray-900 dark:text-white"
                        : "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                    }`}
                  >
                    {level.label}
                  </button>
                ))}
              </div>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Folder Group
            </label>
            <select
              name="groupId"
              value={formData.groupId}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">No group</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Organize folders into named groups on the main page
            </p>
          </div>

          {/* Security */}
          <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Security
            </h3>

            {/* Password protection toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${formData.isPrivate ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-500' : 'bg-gray-200 dark:bg-gray-600 text-gray-400'}`}>
                  <FiLock size={18} />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">Password Protected</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Require a passphrase to view this folder</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFormData((prev) => ({ ...prev, isPrivate: !prev.isPrivate, passphrase: !prev.isPrivate ? prev.passphrase : "" }));
                  setIsDirty(true);
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  formData.isPrivate ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
                role="switch"
                aria-checked={formData.isPrivate}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  formData.isPrivate ? 'translate-x-6' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {/* Passphrase input - only shown when password protection is on */}
            {formData.isPrivate && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Passphrase
                </label>
                <input
                  ref={passphraseInputRef}
                  type="text"
                  name="passphrase"
                  value={formData.passphrase}
                  onChange={handleChange}
                  placeholder="Enter a passphrase"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Visitors must enter this passphrase to view the folder
                </p>
                {formData.isPrivate && !formData.passphrase.trim() && (
                  <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                    Passphrase is required when password protection is enabled.
                  </p>
                )}
              </div>
            )}
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
