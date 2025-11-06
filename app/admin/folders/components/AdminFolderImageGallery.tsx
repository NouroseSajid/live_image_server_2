"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

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
  rotation?: number; // EXIF orientation value
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
  files: File[];
}

interface AdminFolderImageGalleryProps {
  folder: Folder;
  onImageUpdate: () => void;
}

export default function AdminFolderImageGallery({
  folder,
  onImageUpdate,
}: AdminFolderImageGalleryProps) {
  const [selectedImageIds, setSelectedImageIds] = useState<Set<string>>(
    new Set(),
  );
  const [images, setImages] = useState<File[]>(folder.files);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isOrienting, setIsOrienting] = useState(false);
  const [orientationValue, setOrientationValue] = useState<number>(1); // Default to 1 (normal)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"name" | "date" | "size">("date");
  const [editingOrientation, setEditingOrientation] = useState<{
    [key: string]: number;
  }>({});
  const [isSavingOrientation, setIsSavingOrientation] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setImages(folder.files);
    setSelectedImageIds(new Set());
    setStatusMessage(null);
    setEditingOrientation({});
    console.log(
      "Image rotations:",
      folder.files.map((f) => ({ id: f.id, rotation: f.rotation })),
    );
  }, [folder]);

  const exifOrientationToCssTransform = (rotation: number): string => {
    switch (rotation) {
      case 1:
        return "rotate(0deg)";
      case 2:
        return "scaleX(-1)";
      case 3:
        return "rotate(180deg)";
      case 4:
        return "scaleY(-1)";
      case 5:
        return "rotate(90deg) scaleY(-1)";
      case 6:
        return "rotate(90deg)";
      case 7:
        return "rotate(90deg) scaleX(-1)";
      case 8:
        return "rotate(270deg)";
      default:
        return "rotate(0deg)";
    }
  };

  const exifOrientationToDegrees = (rotation: number): number => {
    switch (rotation) {
      case 1:
        return 0;
      case 2:
        return 0;
      case 3:
        return 180;
      case 4:
        return 0;
      case 5:
        return 90;
      case 6:
        return 90;
      case 7:
        return 90;
      case 8:
        return 270;
      default:
        return 0;
    }
  };

  const exifOrientationToCssDegrees = (rotation: number): number => {
    switch (rotation) {
      case 1:
      case 2:
      case 4:
        return 0;
      case 3:
        return 180;
      case 5:
      case 6:
      case 7:
        return 90;
      case 8:
        return 270;
      default:
        return 0;
    }
  };

  // Sort images based on selected criteria
  const sortedImages = [...images].sort((a, b) => {
    switch (sortBy) {
      case "name":
        return a.fileName.localeCompare(b.fileName);
      case "size":
        return Number(a.fileSize - b.fileSize);
      case "date":
      default:
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    }
  });

  const handleImageSelect = (imageId: string) => {
    setSelectedImageIds((prevSelected) => {
      const newSelection = new Set(prevSelected);
      if (newSelection.has(imageId)) {
        newSelection.delete(imageId);
      } else {
        newSelection.add(imageId);
      }
      return newSelection;
    });
  };

  const handleSelectAll = () => {
    if (selectedImageIds.size === images.length) {
      setSelectedImageIds(new Set());
    } else {
      setSelectedImageIds(new Set(images.map((img) => img.id)));
    }
  };

  const getImageUrl = (image: File) => {
    const webpVariant = image.variants.find((v) => v.name === "webp");
    const thumbVariant = image.variants.find((v) => v.name === "thumb");
    const originalVariant = image.variants.find((v) => v.name === "original");
    return (
      thumbVariant?.path || webpVariant?.path || originalVariant?.path || ""
    );
  };

  const getEffectiveOrientation = (image: File) => {
    return editingOrientation[image.id] !== undefined
      ? editingOrientation[image.id]
      : image.rotation || 1;
  };

  const handleOrientationChange = (imageId: string, newOrientation: number) => {
    setEditingOrientation((prev) => ({
      ...prev,
      [imageId]: newOrientation,
    }));
  };

  const saveOrientation = async (imageId: string) => {
    const newOrientation = editingOrientation[imageId];
    if (newOrientation === undefined) return;

    setIsSavingOrientation(imageId);
    try {
      const res = await fetch(`/api/images/${imageId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          rotation: newOrientation,
        }),
      });

      if (res.ok) {
        setStatusMessage({
          type: "success",
          text: "Orientation saved successfully",
        });
        onImageUpdate();
        setEditingOrientation((prev) => {
          const newState = { ...prev };
          delete newState[imageId];
          return newState;
        });
      } else {
        throw new Error("Failed to save orientation");
      }
    } catch (error) {
      setStatusMessage({ type: "error", text: "Failed to save orientation" });
    } finally {
      setIsSavingOrientation(null);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedImageIds.size === 0) {
      setStatusMessage({
        type: "error",
        text: "No images selected for deletion.",
      });
      return;
    }

    if (
      !confirm(
        `Are you sure you want to delete ${selectedImageIds.size} image(s)? This action cannot be undone.`,
      )
    ) {
      return;
    }

    setIsDeleting(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/images/batch-update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageIds: Array.from(selectedImageIds),
          action: "delete",
        }),
      });

      if (res.ok) {
        setStatusMessage({
          type: "success",
          text: `${selectedImageIds.size} image(s) deleted successfully.`,
        });
        setSelectedImageIds(new Set());
        onImageUpdate();
      } else {
        const errorData = await res.json();
        setStatusMessage({
          type: "error",
          text: `Failed to delete images: ${errorData.error || "Unknown error"}`,
        });
      }
    } catch (error) {
      console.error("Error deleting images:", error);
      setStatusMessage({
        type: "error",
        text: "An unexpected error occurred during deletion.",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOrientSelected = async () => {
    if (selectedImageIds.size === 0) {
      setStatusMessage({
        type: "error",
        text: "No images selected for orientation change.",
      });
      return;
    }

    setIsOrienting(true);
    setStatusMessage(null);

    try {
      const res = await fetch("/api/images/batch-update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageIds: Array.from(selectedImageIds),
          action: "orient",
          rotation: orientationValue,
        }),
      });

      if (res.ok) {
        setStatusMessage({
          type: "success",
          text: `${selectedImageIds.size} image(s) oriented successfully.`,
        });
        onImageUpdate();
      } else {
        const errorData = await res.json();
        setStatusMessage({
          type: "error",
          text: `Failed to orient images: ${errorData.error || "Unknown error"}`,
        });
      }
    } catch (error) {
      console.error("Error orienting images:", error);
      setStatusMessage({
        type: "error",
        text: "An unexpected error occurred during orientation.",
      });
    } finally {
      setIsOrienting(false);
    }
  };

  const formatFileSize = (bytes: bigint) => {
    const sizes = ["Bytes", "KB", "MB", "GB"];
    if (bytes === 0n) return "0 Bytes";
    const i = Math.floor(Math.log(Number(bytes)) / Math.log(1024));
    return (
      Math.round((Number(bytes) / Math.pow(1024, i)) * 100) / 100 +
      " " +
      sizes[i]
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getOrientationLabel = (rotation: number) => {
    switch (rotation) {
      case 1:
        return "Normal";
      case 2:
        return "Flip H";
      case 3:
        return "Rotate 180";
      case 4:
        return "Flip V";
      case 5:
        return "Transpose";
      case 6:
        return "Rotate 90 CW";
      case 7:
        return "Transverse";
      case 8:
        return "Rotate 270 CW";
      default:
        return "Unknown";
    }
  };

  const getDisplayOrientation = (image: File) => {
    const effectiveOrientation = getEffectiveOrientation(image);
    const degrees = exifOrientationToDegrees(effectiveOrientation);
    const isRotated90or270 = degrees === 90 || degrees === 270;

    if (image.width && image.height) {
      // When rotated, the effective width and height are swapped.
      const displayWidth = isRotated90or270 ? image.height : image.width;
      const displayHeight = isRotated90or270 ? image.width : image.height;

      return displayWidth > displayHeight ? "landscape" : "portrait";
    }
    return "unknown";
  };

  return (
    <div className="mt-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h3 className="text-2xl font-semibold">Images in {folder.name}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {images.length} images • {selectedImageIds.size} selected
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {/* View Mode Toggle */}
          <div className="flex border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              className={`px-3 py-2 text-sm ${viewMode === "grid" ? "bg-blue-600 text-white" : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"}`}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-2 text-sm ${viewMode === "list" ? "bg-blue-600 text-white" : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"}`}
            >
              List
            </button>
          </div>

          {/* Sort Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
          >
            <option value="date">Sort by Date</option>
            <option value="name">Sort by Name</option>
            <option value="size">Sort by Size</option>
          </select>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`mb-6 p-4 rounded-lg border ${
            statusMessage.type === "success"
              ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800"
              : "bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800"
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      {images.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
          <div className="text-gray-400 dark:text-gray-500 mb-2">
            <svg
              className="w-12 h-12 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
          <p className="text-gray-500 dark:text-gray-400">
            No images in this folder
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
            Upload images using the form above
          </p>
        </div>
      ) : (
        <>
          {/* Bulk Actions Toolbar */}
          {selectedImageIds.size > 0 && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h4 className="font-medium text-blue-900 dark:text-blue-100">
                    {selectedImageIds.size} image(s) selected
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    Choose an action to perform on all selected images
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <select
                    value={orientationValue}
                    onChange={(e) =>
                      setOrientationValue(parseInt(e.target.value))
                    }
                    className="border rounded px-3 py-2 text-sm bg-white dark:bg-gray-800"
                    disabled={isOrienting}
                  >
                    {[...Array(8)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {getOrientationLabel(i + 1)}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={handleOrientSelected}
                    disabled={isOrienting}
                    className="px-4 py-2 rounded bg-blue-600 text-white text-sm disabled:opacity-50 hover:bg-blue-700 transition-colors"
                  >
                    {isOrienting ? "Orienting..." : "Orient Selected"}
                  </button>

                  <button
                    onClick={handleDeleteSelected}
                    disabled={isDeleting}
                    className="px-4 py-2 rounded bg-red-600 text-white text-sm disabled:opacity-50 hover:bg-red-700 transition-colors"
                  >
                    {isDeleting ? "Deleting..." : "Delete Selected"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Select All */}
          <div className="mb-4">
            <button
              onClick={handleSelectAll}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
            >
              {selectedImageIds.size === images.length
                ? "Deselect All"
                : "Select All"}
            </button>
          </div>

          {/* Images Grid/List */}
          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {sortedImages.map((image) => {
                const isSelected = selectedImageIds.has(image.id);
                const currentOrientation = getEffectiveOrientation(image);
                const displayOrientation = getDisplayOrientation(image);
                const hasOrientationEdit =
                  editingOrientation[image.id] !== undefined;
                const degrees = exifOrientationToCssDegrees(currentOrientation);

                return (
                  <div
                    key={image.id}
                    className={`relative group cursor-pointer border-2 rounded-lg overflow-hidden transition-all duration-200 ${
                      isSelected
                        ? "border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800"
                        : "border-transparent hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                    onClick={() => handleImageSelect(image.id)}
                    style={{
                      backgroundColor: "var(--admin-card)",
                    }}
                  >
                    {/* Image Container */}
                    <div
                      className="relative bg-gray-100 dark:bg-gray-800"
                      style={{
                        paddingBottom: `${
                          degrees === 90 || degrees === 270
                            ? ((image.width || 1) / (image.height || 1)) * 100
                            : ((image.height || 1) / (image.width || 1)) * 100
                        }%`,
                      }}
                    >
                      <Image
                        src={getImageUrl(image)}
                        alt={image.fileName}
                        fill={true}
                        style={{
                          objectFit: "contain",
                          transform:
                            exifOrientationToCssTransform(currentOrientation),
                          transformOrigin: "center",
                          transition: "transform 0.3s ease-in-out",
                        }}
                        className="transition-transform group-hover:scale-105"
                      />

                      {/* Selection Overlay */}
                      {isSelected && (
                        <div className="absolute inset-0 flex items-center justify-center bg-blue-500 bg-opacity-20">
                          <div className="bg-blue-600 rounded-full p-1">
                            <svg
                              className="w-6 h-6 text-white"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </div>
                        </div>
                      )}

                      {/* Orientation Badge */}
                      <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                        <span>{getOrientationLabel(currentOrientation)}</span>
                      </div>

                      {/* Display Orientation Badge */}
                      <div
                        className={`absolute top-2 left-2 text-xs px-2 py-1 rounded-full capitalize ${
                          displayOrientation === "landscape"
                            ? "bg-orange-500 text-white"
                            : displayOrientation === "portrait"
                              ? "bg-purple-500 text-white"
                              : "bg-gray-500 text-white"
                        }`}
                      >
                        {displayOrientation}
                      </div>
                    </div>

                    {/* Image Info */}
                    <div className="p-3">
                      <p
                        className="text-sm font-medium truncate mb-1"
                        title={image.fileName}
                      >
                        {image.fileName}
                      </p>
                      <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                        <span>{formatFileSize(image.fileSize)}</span>
                        <span>{formatDate(image.createdAt)}</span>
                      </div>

                      {/* Orientation Controls */}
                      <div className="mt-3 flex items-center gap-2">
                        <select
                          value={currentOrientation}
                          onChange={(e) =>
                            handleOrientationChange(
                              image.id,
                              parseInt(e.target.value),
                            )
                          }
                          className="flex-1 text-xs border rounded px-2 py-1 bg-white dark:bg-gray-800"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {[...Array(8)].map((_, i) => (
                            <option key={i + 1} value={i + 1}>
                              {getOrientationLabel(i + 1)}
                            </option>
                          ))}
                        </select>

                        {hasOrientationEdit && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              saveOrientation(image.id);
                            }}
                            disabled={isSavingOrientation === image.id}
                            className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                          >
                            {isSavingOrientation === image.id ? "..." : "Save"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* List View */
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800 border-b">
                  <tr>
                    <th className="w-12 p-3">
                      <input
                        type="checkbox"
                        checked={selectedImageIds.size === images.length}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="text-left p-3 text-sm font-medium">Image</th>
                    <th className="text-left p-3 text-sm font-medium">Name</th>
                    <th className="text-left p-3 text-sm font-medium">Size</th>
                    <th className="text-left p-3 text-sm font-medium">
                      Display
                    </th>
                    <th className="text-left p-3 text-sm font-medium">
                      Orientation
                    </th>
                    <th className="text-left p-3 text-sm font-medium">Date</th>
                    <th className="text-left p-3 text-sm font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedImages.map((image) => {
                    const isSelected = selectedImageIds.has(image.id);
                    const currentOrientation = getEffectiveOrientation(image);
                    const displayOrientation = getDisplayOrientation(image);
                    const hasOrientationEdit =
                      editingOrientation[image.id] !== undefined;
                    const degrees =
                      exifOrientationToCssDegrees(currentOrientation);

                    return (
                      <tr
                        key={image.id}
                        className={`border-b hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                          isSelected ? "bg-blue-50 dark:bg-blue-900/20" : ""
                        }`}
                      >
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleImageSelect(image.id)}
                            className="rounded border-gray-300"
                          />
                        </td>
                        <td className="p-3">
                          <div className="w-16 h-16 relative">
                            <Image
                              src={getImageUrl(image)}
                              alt={image.fileName}
                              width={64}
                              height={64}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                transform:
                                  exifOrientationToCssTransform(
                                    currentOrientation,
                                  ),
                                transformOrigin: "center",
                              }}
                              className="rounded"
                            />
                          </div>
                        </td>
                        <td className="p-3">
                          <p
                            className="font-medium text-sm"
                            title={image.fileName}
                          >
                            {image.fileName}
                          </p>
                        </td>
                        <td className="p-3 text-sm text-gray-600 dark:text-gray-400">
                          {formatFileSize(image.fileSize)}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium capitalize ${
                              displayOrientation === "landscape"
                                ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
                                : displayOrientation === "portrait"
                                  ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                                  : "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
                            }`}
                          >
                            {displayOrientation}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <select
                              value={currentOrientation}
                              onChange={(e) =>
                                handleOrientationChange(
                                  image.id,
                                  parseInt(e.target.value),
                                )
                              }
                              className="text-sm border rounded px-2 py-1 bg-white dark:bg-gray-800"
                            >
                              {[...Array(8)].map((_, i) => (
                                <option key={i + 1} value={i + 1}>
                                  {getOrientationLabel(i + 1)}
                                </option>
                              ))}
                            </select>
                            {hasOrientationEdit && (
                              <button
                                onClick={() => saveOrientation(image.id)}
                                disabled={isSavingOrientation === image.id}
                                className="text-xs bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
                              >
                                {isSavingOrientation === image.id
                                  ? "..."
                                  : "Save"}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="p-3 text-sm text-gray-600 dark:text-gray-400">
                          {formatDate(image.createdAt)}
                        </td>
                        <td className="p-3">
                          <button
                            onClick={() => handleImageSelect(image.id)}
                            className="text-red-600 hover:text-red-800 text-sm transition-colors"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
