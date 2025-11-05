"use client";

import { useState } from 'react';
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import type { Image as GalleryImage } from '@/app/types/gallery';

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

  const exifOrientationToCssTransform = (rotation: number): string => {
    switch (rotation) {
      case 1: return 'rotate(0deg)';
      case 2: return 'scaleX(-1)';
      case 3: return 'rotate(180deg)';
      case 4: return 'scaleY(-1)';
      case 5: return 'rotate(90deg) scaleY(-1)';
      case 6: return 'rotate(90deg)';
      case 7: return 'rotate(90deg) scaleX(-1)';
      case 8: return 'rotate(270deg)';
      default: return 'rotate(0deg)';
    }
  };

  const exifOrientationToDegrees = (rotation: number): number => {
    switch (rotation) {
      case 1: return 0;
      case 2: return 0;
      case 3: return 180;
      case 4: return 0;
      case 5: return 90;
      case 6: return 90;
      case 7: return 90;
      case 8: return 270;
      default: return 0;
    }
  };

  const getImageVariant = (image: GalleryImage, preferredTypes: string[]) => {
    for (const type of preferredTypes) {
      const variant = image.variants.find(v => v.name === type);
      if (variant) return variant;
    }
    return image.variants[0];
  };

  const photos: Photo[] = images.map((image) => {
    // For grid view, prefer thumb > webp > original
    const gridVariant = getImageVariant(image, ["thumb", "webp"]);
    // For lightbox, prefer webp > original
    const lightboxVariant = getImageVariant(image, ["webp"]);
    
    if (!image.width || !image.height) {
      console.warn(`Image ${image.fileName} is missing width or height information.`);
    }

    return {
      src: gridVariant?.path || '',
      width: image.width || 1600,
      height: image.height || 1200,
      alt: image.fileName,
      // Add lightbox source for high quality view
      lightboxSrc: lightboxVariant?.path || '',
      rotation: image.rotation || 1,
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
              <div
                style={{
                  paddingBottom: `${
                    (exifOrientationToDegrees(photo.rotation || 1) === 90 || exifOrientationToDegrees(photo.rotation || 1) === 270)
                      ? (photo.width / photo.height) * 100
                      : (photo.height / photo.width) * 100
                  }%`,
                }}
              >
                <img
                  src={photo.src}
                  alt={photo.alt}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    transform: exifOrientationToCssTransform(photo.rotation || 1),
                  }}
                  className="transition-transform duration-300 group-hover:scale-110"
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
        ))}
      </div>

      <Lightbox
        slides={photos.map(photo => ({
          ...photo,
          src: photo.lightboxSrc,
          width: photo.width,
          height: photo.height,
        }))}
        open={index >= 0}
        index={index}
        close={() => setIndex(-1)}
        carousel={{
          finite: true
        }}
        animation={{
          fade: 300
        }}
        render={{
          slide: ({ slide, rect }) => {
            const photo = photos.find(p => p.lightboxSrc === slide.src);
            const rotation = photo?.rotation || 0;

            // Calculate effective dimensions for rotation
            let effectiveWidth = slide.width;
            let effectiveHeight = slide.height;
            if (rotation === 90 || rotation === 270) {
              effectiveWidth = slide.height;
              effectiveHeight = slide.width;
            }

            // Calculate scale to fit rotated image within available space
            const scaleX = rect.width / effectiveWidth;
            const scaleY = rect.height / effectiveHeight;
            const scale = Math.min(scaleX, scaleY, 1); // Ensure image doesn't scale up beyond its natural size

            return (
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <img
                  src={slide.src}
                  alt={slide.alt}
                  style={{
                    display: 'block',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    transform: `rotate(${rotation}deg) scale(${scale})`,
                    transition: 'transform 0.3s ease-in-out',
                  }}
                />
              </div>
            );
          },
        }}
      />
    </>
  );
}