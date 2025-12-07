"use client";

import Image from "next/image";
import { useState } from "react";
import "yet-another-react-lightbox/styles.css";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import type { Image as GalleryImage } from "@/app/types/gallery";

interface PhotoGridProps {
  images: GalleryImage[];
}

interface Photo {
  src: string;
  width: number;
  height: number;
  alt?: string;
  lightboxSrc: string;
  rotation?: number;
  aspectRatio: number;
}

export default function PhotoGrid({ images }: PhotoGridProps) {
  const [index, setIndex] = useState(-1);

  // Fixed dimension calculation - no more EXIF rotation logic needed
  const getImageDimensions = (width: number, height: number) => {
    return {
      displayWidth: width,
      displayHeight: height,
      aspectRatio: width / height,
    };
  };

  const getImageVariant = (image: GalleryImage, preferredTypes: string[]) => {
    for (const type of preferredTypes) {
      const variant = image.variants.find((v) => v.name === type);
      if (variant) return variant;
    }

    // Fallback to 'full' or 'original' if preferred types are not found
    const fullVariant = image.variants.find((v) => v.name === "full");
    if (fullVariant) return fullVariant;
    const originalVariant = image.variants.find((v) => v.name === "original");
    if (originalVariant) return originalVariant;

    // If still not found, try to find any non-thumbnail variant
    const nonThumbVariant = image.variants.find((v) => v.name !== "thumb");
    if (nonThumbVariant) return nonThumbVariant;

    // As a last resort, return the first variant (could be a thumbnail)
    return image.variants[0];
  };

  const photos: Photo[] = images.map((image) => {
    const gridVariant = getImageVariant(image, ["thumbnail", "webp"]);
    const lightboxVariant = getImageVariant(image, ["webp"]);

    if (!image.width || !image.height) {
      console.warn(
        `Image ${image.fileName} is missing width or height information.`,
      );
    }

    const { displayWidth, displayHeight, aspectRatio } = getImageDimensions(
      image.width || 1600,
      image.height || 1200,
    );

    return {
      src: gridVariant?.path || "",
      width: displayWidth,
      height: displayHeight,
      aspectRatio,
      alt: image.fileName,
      lightboxSrc: lightboxVariant?.path || "",
      rotation: 1, // Always 1 - images are physically rotated now
    };
  });

  return (
    <>
      {/* Masonry Grid with Tailwind Columns */}
      <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4 p-4 space-y-4">
        {photos.map((photo, idx) => (
          <div
            key={idx}
            className="break-inside-avoid mb-4 group cursor-pointer transform transition-all duration-300 hover:scale-105"
            onClick={() => setIndex(idx)}
          >
            <div className="relative overflow-hidden rounded-xl shadow-lg border border-gray-200/10">
              {/* Fixed aspect ratio container based on DB width/height */}
              <div
                className="relative w-full"
                style={{
                  paddingBottom: `${(1 / photo.aspectRatio) * 100}%`,
                }}
              >
                <Image
                  src={photo.src}
                  alt={photo.alt || ""}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px"
                  style={{ objectFit: "cover" }}
                  className="absolute inset-0 w-full h-full transition-transform duration-300 group-hover:scale-110 rounded-xl"
                  loading="lazy"
                  unoptimized
                />
              </div>
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                <p className="text-white text-sm font-medium px-4 py-2 bg-black/60 rounded-lg transform translate-y-2 group-hover:translate-y-0 transition-transform duration-200">
                  View Image
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Lightbox
        slides={photos.map((photo) => ({
          ...photo,
          src: photo.lightboxSrc,
          width: photo.width,
          height: photo.height,
        }))}
        open={index >= 0}
        index={index}
        close={() => setIndex(-1)}
        carousel={{
          finite: true,
        }}
        animation={{
          fade: 300,
        }}
        plugins={[Zoom]}
      />
    </>
  );
}
