"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, Circle, Download, Eye } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { useSelection } from "@/app/hooks/useSelection";
import type { Image as GalleryImage, ImageVariant } from "@/app/types/gallery";

interface EnhancedGalleryItemProps {
  image: GalleryImage;
  isNew?: boolean;
  onSelect: () => void;
  showCheckbox?: boolean;
}

export default function EnhancedGalleryItem({
  image,
  isNew = false,
  onSelect,
  showCheckbox = true,
}: EnhancedGalleryItemProps) {
  const { isImageSelected, toggleSelection } = useSelection();
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const isSelected = isImageSelected(image.id);

  // Get the best variant for display
  const displayVariant =
    image.variants.find((v: ImageVariant) => v.name === "thumbnail")?.path ||
    image.variants.find((v: ImageVariant) => v.name === "webp")?.path ||
    image.variants.find((v: ImageVariant) => v.name === "original")?.path ||
    "/placeholder-image.jpg";

  const handleSelectClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleSelection(image);
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const originalVariant = image.variants.find(
      (v: ImageVariant) => v.name === "original",
    );
    if (originalVariant) {
      const link = document.createElement("a");
      link.href = originalVariant.path;
      link.download = image.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // Format file size
  const formatFileSize = (bytes: bigint | number) => {
    const numBytes = typeof bytes === "bigint" ? Number(bytes) : bytes;
    if (numBytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(numBytes) / Math.log(k));
    return `${parseFloat((numBytes / k ** i).toFixed(1))} ${sizes[i]}`;
  };

  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div
      className="relative w-full h-full"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onSelect}
    >
      {/* Image Container */}
      <div className="relative w-full h-full overflow-hidden rounded-lg bg-gray-100">
        <Image
          src={displayVariant}
          alt={image.fileName}
          fill
          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 25vw, 300px"
          className={`object-cover transition-all duration-300 ${
            imageLoaded ? "opacity-100" : "opacity-0"
          } ${isHovered ? "scale-110" : "scale-100"}`}
          onLoad={() => setImageLoaded(true)}
          unoptimized
        />

        {/* Loading Skeleton */}
        <AnimatePresence>
          {!imageLoaded && (
            <motion.div
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 animate-pulse"
            />
          )}
        </AnimatePresence>

        {/* Overlay Gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        <div className="absolute inset-0 bg-gradient-to-br from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      </div>

      {/* Selection Checkbox */}
      {showCheckbox && (
        <motion.div
          className="absolute top-3 left-3 z-10"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div
            onClick={handleSelectClick}
            className={`p-2 rounded-full backdrop-blur-sm transition-all duration-200 cursor-pointer ${
              isSelected
                ? "bg-blue-500 text-white shadow-lg"
                : "bg-white/80 text-gray-600 hover:bg-white hover:shadow-md"
            }`}
          >
            {isSelected ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <Circle className="w-4 h-4" />
            )}
          </div>
        </motion.div>
      )}

      {/* New Badge */}
      <AnimatePresence>
        {isNew && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute top-3 right-3 z-10"
          >
            <span className="px-2.5 py-1 bg-green-500 text-white text-xs font-bold rounded-full shadow-lg">
              NEW
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hover Actions */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-3 left-3 right-3 z-10"
          >
            <div className="flex gap-2 justify-center">
              {/* View Button */}
              <button
                onClick={onSelect}
                className="flex items-center gap-2 px-3 py-2 bg-white/90 backdrop-blur-sm rounded-lg text-gray-800 hover:bg-white transition-all duration-200 shadow-lg"
              >
                <Eye className="w-4 h-4" />
                <span className="text-sm font-medium">View</span>
              </button>

              {/* Download Button */}
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-3 py-2 bg-white/90 backdrop-blur-sm rounded-lg text-gray-800 hover:bg-white transition-all duration-200 shadow-lg"
              >
                <Download className="w-4 h-4" />
                <span className="text-sm font-medium">Download</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Info Overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
        <div className="space-y-1">
          {/* Filename */}
          <p className="text-white text-sm font-medium truncate">
            {image.fileName}
          </p>

          {/* Metadata */}
          <div className="flex items-center gap-3 text-white/80 text-xs">
            {image.width && image.height && (
              <span>
                {image.width}×{image.height}
              </span>
            )}
            {image.fileSize && <span>{formatFileSize(image.fileSize)}</span>}
            {image.createdAt && <span>{formatDate(image.createdAt)}</span>}
          </div>
        </div>
      </div>

      {/* Selected Overlay */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-blue-500/20 border-2 border-blue-500 rounded-lg"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
