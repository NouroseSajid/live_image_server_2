"use client";

import { useState } from "react";
import { useSelection } from "@/app/hooks/useSelection";
import { X, Download, Loader } from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";

export function SelectionToolbar() {
  const { selectedImages, clearSelection } = useSelection();
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    const zip = new JSZip();

    try {
      const imagePromises = selectedImages.map(async (image) => {
        const bestUrl =
          image.variants.find((v) => v.name === "large")?.path ||
          image.variants.find((v) => v.name === "webp")?.path ||
          "";
        if (bestUrl) {
          const response = await fetch(bestUrl);
          const blob = await response.blob();
          zip.file(image.fileName, blob);
        }
      });

      await Promise.all(imagePromises);

      const zipBlob = await zip.generateAsync({ type: "blob" });
      saveAs(zipBlob, `images-${new Date().toISOString()}.zip`);
    } catch (error) {
      console.error("Error creating zip file", error);
      // Optionally, show an error message to the user
    } finally {
      setIsDownloading(false);
      clearSelection();
    }
  };

  if (selectedImages.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-auto bg-gray-800 text-white p-4 rounded-lg shadow-lg flex items-center gap-4 z-50">
      <span className="font-bold text-lg">{selectedImages.length}</span>
      <span>selected</span>
      <button
        onClick={handleDownload}
        className="p-2 rounded-full bg-blue-500 hover:bg-blue-600 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
        aria-label="Download selected images"
        disabled={isDownloading}
      >
        {isDownloading ? (
          <Loader className="animate-spin" size={20} />
        ) : (
          <Download size={20} />
        )}
      </button>
      <button
        onClick={clearSelection}
        className="p-2 rounded-full bg-red-500 hover:bg-red-600 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
        aria-label="Clear selection"
        disabled={isDownloading}
      >
        <X size={20} />
      </button>
    </div>
  );
}
