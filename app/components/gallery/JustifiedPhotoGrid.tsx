"use client";

import { useState, useEffect, useMemo } from "react";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import type { Image as GalleryImage } from "@/app/types/gallery";
import GalleryGridItem from "../GalleryGridItem";
import { ChevronDown, Loader2 } from "lucide-react";

interface EnhancedJustifiedGridProps {
  images: GalleryImage[];
  newImageIds?: Set<string>;
  itemsPerPage?: number;
  containerWidth?: number;
}

interface ProcessedRow {
  images: GalleryImage[];
  height: number;
  width: number;
}

interface ImageDimensions {
  width: number;
  height: number;
  aspectRatio: number;
}

// Advanced justified layout algorithm
function computeJustifiedRows(
  images: GalleryImage[],
  containerWidth: number,
  targetRowHeight: number = 200,
  minRowHeight: number = 150,
  maxRowHeight: number = 300,
): ProcessedRow[] {
  if (!images.length || containerWidth <= 0) return [];

  const rows: ProcessedRow[] = [];
  let currentRow: GalleryImage[] = [];
  let currentAspectRatioSum = 0;

  for (const image of images) {
    const width = image.width || 1200;
    const height = image.height || 800;
    const aspectRatio = width / height;

    if (width === 0 || height === 0) continue;

    // Calculate what the row height would be if we added this image
    const newAspectRatioSum = currentAspectRatioSum + aspectRatio;
    const potentialRowHeight =
      (containerWidth - currentRow.length * 8) / newAspectRatioSum;

    // If adding this image would make the row too short, or if it's the first image
    if (currentRow.length > 0 && potentialRowHeight < minRowHeight) {
      // Finalize current row with optimal height
      const optimalHeight = Math.max(
        minRowHeight,
        Math.min(
          maxRowHeight,
          (containerWidth - (currentRow.length - 1) * 8) /
            currentAspectRatioSum,
        ),
      );

      rows.push({
        images: [...currentRow],
        height: optimalHeight,
        width: containerWidth,
      });

      // Start new row with current image
      currentRow = [image];
      currentAspectRatioSum = aspectRatio;
    } else {
      // Add to current row
      currentRow.push(image);
      currentAspectRatioSum = newAspectRatioSum;
    }
  }

  // Handle remaining images in the last row
  if (currentRow.length > 0) {
    const optimalHeight = Math.max(
      minRowHeight,
      Math.min(
        maxRowHeight,
        (containerWidth - (currentRow.length - 1) * 8) / currentAspectRatioSum,
      ),
    );

    rows.push({
      images: currentRow,
      height: optimalHeight,
      width: containerWidth,
    });
  }

  return rows;
}

export default function EnhancedJustifiedGrid({
  images,
  newImageIds,
  itemsPerPage = 50,
  containerWidth = 1200,
}: EnhancedJustifiedGridProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [containerRef, setContainerRef] = useState<HTMLDivElement | null>(null);

  // Calculate actual container width
  const actualContainerWidth = containerRef?.offsetWidth || containerWidth;

  // Sort images by creation date (newest first)
  const sortedImages = useMemo(() => {
    return [...images].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA; // Newest first
    });
  }, [images]);

  // Paginate images
  const paginatedImages = useMemo(() => {
    const startIndex = 0;
    const endIndex = currentPage * itemsPerPage;
    return sortedImages.slice(startIndex, endIndex);
  }, [sortedImages, currentPage, itemsPerPage]);

  // Compute rows for the layout
  const rows = useMemo(() => {
    return computeJustifiedRows(paginatedImages, actualContainerWidth);
  }, [paginatedImages, actualContainerWidth]);

  // Check if there are more images to load
  const hasMoreImages = currentPage * itemsPerPage < sortedImages.length;

  // Handle load more
  const handleLoadMore = async () => {
    if (isLoading || !hasMoreImages) return;

    setIsLoading(true);

    // Simulate loading delay for smooth UX
    await new Promise((resolve) => setTimeout(resolve, 500));

    setCurrentPage((prev) => prev + 1);
    setIsLoading(false);
  };

  // Handle image selection for lightbox
  const handleImageSelect = (rowIndex: number, imageIndex: number) => {
    // Calculate global index across all rows
    let globalIndex = 0;
    for (let i = 0; i < rowIndex; i++) {
      globalIndex += rows[i].images.length;
    }
    globalIndex += imageIndex;
    setSelectedIndex(globalIndex);
  };

  // Prepare lightbox slides
  const lightboxSlides = useMemo(() => {
    return paginatedImages.map((image) => {
      const webpVariant = image.variants.find((v) => v.name === "webp");
      const largeVariant = image.variants.find((v) => v.name === "large");
      const originalVariant = image.variants.find((v) => v.name === "original");

      return {
        src:
          largeVariant?.path ||
          webpVariant?.path ||
          originalVariant?.path ||
          "",
        width: image.width || 1600,
        height: image.height || 1200,
        alt: image.fileName,
      };
    });
  }, [paginatedImages]);

  return (
    <div className="w-full">
      {/* Gallery Grid */}
      <div ref={setContainerRef} className="w-full max-w-7xl mx-auto px-4 py-6">
        <div className="space-y-4">
          {rows.map((row, rowIndex) => (
            <div
              key={rowIndex}
              className="flex gap-2"
              style={{ height: `${row.height}px` }}
            >
              {row.images.map((image, imageIndex) => {
                const width = image.width || 1600;
                const height = image.height || 1200;

                if (width === 0 || height === 0) return null;

                const aspectRatio = width / height;
                const calculatedWidth = aspectRatio * row.height;

                return (
                  <div
                    key={image.id}
                    style={{
                      width: `${calculatedWidth}px`,
                      height: `${row.height}px`,
                    }}
                    className="relative flex-shrink-0 rounded-lg overflow-hidden shadow-md border border-gray-200/10 cursor-pointer group"
                    onClick={() => handleImageSelect(rowIndex, imageIndex)}
                  >
                    <GalleryGridItem
                      image={image}
                      isNew={newImageIds?.has(image.id) ?? false}
                      onSelect={() => handleImageSelect(rowIndex, imageIndex)}
                    />{" "}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Load More Button */}
        {hasMoreImages && (
          <div className="flex justify-center mt-12 mb-8">
            <button
              onClick={handleLoadMore}
              disabled={isLoading}
              className="flex items-center gap-3 px-8 py-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white font-medium hover:bg-white/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ChevronDown className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
              )}
              <span>
                {isLoading
                  ? "Loading..."
                  : `Load More Images (${Math.min(itemsPerPage, sortedImages.length - currentPage * itemsPerPage)} remaining)`}
              </span>
            </button>
          </div>
        )}

        {/* Image Count */}
        <div className="text-center text-gray-400 text-sm mt-4">
          Showing {paginatedImages.length} of {sortedImages.length} images
        </div>
      </div>

      {/* Lightbox */}
      <Lightbox
        slides={lightboxSlides}
        open={selectedIndex >= 0}
        index={selectedIndex}
        close={() => setSelectedIndex(-1)}
        carousel={{ finite: true }}
        animation={{ fade: 300 }}
        toolbar={{ buttons: ["close"] }}
        on={{
          view: ({ index: currentIndex }) => setSelectedIndex(currentIndex),
        }}
        styles={{
          slide: { borderRadius: "12px" },
          container: { backgroundColor: "rgba(0, 0, 0, 0.9)" },
        }}
      />
    </div>
  );
}
