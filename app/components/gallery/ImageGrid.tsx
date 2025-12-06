"use client";

import { useState } from "react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
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
}

export default function PhotoGrid({ images }: PhotoGridProps) {
  const [index, setIndex] = useState(-1);

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

  const getImageDimensions = (
    width: number,
    height: number,
    rotation: number,
  ) => {
    const rotationDegrees = exifOrientationToDegrees(rotation);

    // Swap dimensions for 90° and 270° rotations
    if (rotationDegrees === 90 || rotationDegrees === 270) {
      return {
        displayWidth: height,
        displayHeight: width,
        aspectRatio: height / width,
        rotationDegrees,
      };
    }

    return {
      displayWidth: width,
      displayHeight: height,
      aspectRatio: width / height,
      rotationDegrees,
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
    const gridVariant = getImageVariant(image, ["thumb", "webp"]);
    const lightboxVariant = getImageVariant(image, ["webp"]);

    if (!image.width || !image.height) {
      console.warn(
        `Image ${image.fileName} is missing width or height information.`,
      );
    }

    const { displayWidth, displayHeight, aspectRatio } = getImageDimensions(
      image.width || 1600,
      image.height || 1200,
      image.rotation || 1,
    );

    return {
      src: gridVariant?.path || "",
      width: displayWidth,
      height: displayHeight,
      aspectRatio,
      alt: image.fileName,
      lightboxSrc: lightboxVariant?.path || "",
      rotation: image.rotation || 1,
    };
  });

  return (
    <>
      {/* Masonry Grid with Tailwind Columns */}
      <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4 p-4 space-y-4">
        {photos.map((photo, idx) => {
          const rotationDegrees = exifOrientationToDegrees(photo.rotation || 1);

          return (
            <div
              key={idx}
              className="break-inside-avoid mb-4 group cursor-pointer transform transition-all duration-300 hover:scale-105"
              onClick={() => setIndex(idx)}
            >
              <div className="relative overflow-hidden rounded-xl shadow-lg border border-gray-200/10">
                {/* Fixed aspect ratio container based on rotated dimensions */}
                <div
                  className="relative w-full"
                  style={{
                    paddingBottom: `${(1 / photo.aspectRatio) * 100}%`,
                  }}
                >
                  <img
                    src={photo.src}
                    alt={photo.alt}
                    className="absolute inset-0 w-full h-full transition-transform duration-300 group-hover:scale-110"
                    style={{
                      transform: `rotate(${rotationDegrees}deg)`,
                      objectFit:
                        rotationDegrees === 90 || rotationDegrees === 270
                          ? "contain"
                          : "cover",
                    }}
                    loading="lazy"
                  />
                </div>
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                  <p className="text-white text-sm font-medium px-4 py-2 bg-black/60 rounded-lg transform translate-y-2 group-hover:translate-y-0 transition-transform duration-200">
                    View Image
                  </p>
                </div>
              </div>
            </div>
          );
        })}
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
