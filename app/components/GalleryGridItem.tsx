"use client";

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import type { Image as GalleryImage, ImageVariant } from '../types/gallery';

interface GalleryGridItemProps {
  image: GalleryImage;
  index: number;
  batchSize: number;
  onSelect: (index: number) => void;
}

export default function GalleryGridItem({ image, index, batchSize, onSelect }: GalleryGridItemProps) {
  const thumbnailUrl = 
    image.variants.find((v: ImageVariant) => v.name === "thumbnail")?.path ||
    image.variants.find((v: ImageVariant) => v.name === "webp")?.path ||
    "/placeholder-image.jpg";

  return (
    <motion.div
      key={image.id}
      className="relative group cursor-pointer"
      onClick={() => onSelect(index)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.3,
        delay: (index % batchSize) * 0.05,
        ease: "easeOut"
      }}
    >
      <Image
        src={thumbnailUrl}
        alt={image.fileName}
        width={400}
        height={300}
        className="w-full h-32 object-contain rounded-xl shadow-lg border border-gray-200 bg-gray-50 group-hover:scale-105 transition"
        priority={index < 4}
      />
      <motion.div
        initial={{ opacity: 0 }}
        whileHover={{ opacity: 1 }}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center rounded-xl"
      >
        <p className="text-white text-sm font-medium">View</p>
      </motion.div>
    </motion.div>
  );
}