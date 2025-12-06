"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import type { Image as GalleryImage, ImageVariant } from "../types/gallery";
import { useSelection } from "@/app/hooks/useSelection";
import { CheckCircle, Circle } from "lucide-react";

interface GalleryGridItemProps {
  image: GalleryImage;
  index: number;
  batchSize: number;
  onSelect: (index: number) => void;
  isNew?: boolean;
}

export default function GalleryGridItem({
  image,
  index,
  batchSize,
  onSelect,
  isNew = false,
}: GalleryGridItemProps) {
  const { isImageSelected, toggleSelection } = useSelection();
  const thumbnailUrl =
    image.variants.find((v: ImageVariant) => v.name === "thumbnail")?.path ||
    image.variants.find((v: ImageVariant) => v.name === "webp")?.path ||
    "/placeholder-image.jpg";

  const isSelected = isImageSelected(image.id);

  const handleSelectClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleSelection(image);
  };

  return (
    <motion.div
      className="relative group cursor-pointer"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.3,
        delay: (index % batchSize) * 0.05,
        ease: "easeOut",
      }}
    >
      <div onClick={() => onSelect(index)}>
        <Image
          src={thumbnailUrl}
          alt={image.fileName}
          width={400}
          height={300}
          className={`w-full h-32 object-contain rounded-xl shadow-lg bg-gray-50 transition-all duration-200 ${
            isSelected
              ? "border-4 border-blue-500 scale-95"
              : "border-2 border-gray-200 group-hover:scale-105"
          }`}
          priority={index < 4}
        />
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isSelected ? 1 : 0 }}
          whileHover={{ opacity: 1 }}
          className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center rounded-xl"
        >
          <p className="text-white text-sm font-medium">
            {isSelected ? "Selected" : "View"}
          </p>
        </motion.div>
      </div>

      <div
        onClick={handleSelectClick}
        className="absolute top-2 left-2 z-10 p-1 bg-white/70 rounded-full"
      >
        {isSelected ? (
          <CheckCircle className="text-blue-500" />
        ) : (
          <Circle className="text-gray-500" />
        )}
      </div>

      {isNew && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          className="absolute top-2 right-2 z-10 px-2 py-1 bg-green-500 text-white text-xs font-bold rounded-md shadow-lg"
        >
          NEW
        </motion.div>
      )}
    </motion.div>
  );
}
