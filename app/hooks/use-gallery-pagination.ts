"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import type { Image as GalleryImage } from "@/app/types/gallery";

interface UseGalleryPaginationProps {
  images: GalleryImage[];
  itemsPerPage?: number;
  sortBy?: "newest" | "oldest" | "name" | "size";
  filterBy?: {
    type?: "image" | "video";
    dateRange?: {
      start: Date;
      end: Date;
    };
    searchTerm?: string;
  };
}

interface UseGalleryPaginationReturn {
  // Data
  paginatedImages: GalleryImage[];
  allImages: GalleryImage[];

  // Pagination state
  currentPage: number;
  totalPages: number;
  totalImages: number;
  hasMore: boolean;
  isLoading: boolean;

  // Actions
  loadMore: () => Promise<void>;
  resetPagination: () => void;
  goToPage: (page: number) => void;
  setItemsPerPage: (count: number) => void;

  // New image detection
  newImageIds: Set<string>;
  markImagesAsViewed: () => void;
}

export function useGalleryPagination({
  images = [],
  itemsPerPage = 50,
  sortBy = "newest",
  filterBy,
}: UseGalleryPaginationProps): UseGalleryPaginationReturn {
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [newImageIds, setNewImageIds] = useState<Set<string>>(new Set());
  const [itemsPerPageState, setItemsPerPageState] = useState(itemsPerPage);

  // Filter and sort images
  const processedImages = useMemo(() => {
    let filtered = [...images];

    // Apply type filter
    if (filterBy?.type) {
      filtered = filtered.filter((img) => img.fileType === filterBy.type);
    }

    // Apply search filter
    if (filterBy?.searchTerm) {
      const term = filterBy.searchTerm.toLowerCase();
      filtered = filtered.filter((img) =>
        img.fileName.toLowerCase().includes(term),
      );
    }

    // Apply date range filter
    if (filterBy?.dateRange) {
      filtered = filtered.filter((img) => {
        if (!img.createdAt) return false;
        const imgDate = new Date(img.createdAt);
        return (
          imgDate >= filterBy.dateRange!.start &&
          imgDate <= filterBy.dateRange!.end
        );
      });
    }

    // Sort images
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "newest":
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;

        case "oldest":
          const dateAOldest = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateBOldest = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateAOldest - dateBOldest;

        case "name":
          return a.fileName.localeCompare(b.fileName);

        case "size":
          const sizeA =
            typeof a.fileSize === "bigint"
              ? Number(a.fileSize)
              : a.fileSize || 0;
          const sizeB =
            typeof b.fileSize === "bigint"
              ? Number(b.fileSize)
              : b.fileSize || 0;
          return sizeB - sizeA;

        default:
          return 0;
      }
    });

    return filtered;
  }, [images, sortBy, filterBy]);

  // Calculate pagination
  const totalImages = processedImages.length;
  const totalPages = Math.ceil(totalImages / itemsPerPageState);
  const hasMore = currentPage < totalPages;

  // Get paginated images
  const paginatedImages = useMemo(() => {
    const startIndex = 0;
    const endIndex = currentPage * itemsPerPageState;
    return processedImages.slice(startIndex, endIndex);
  }, [processedImages, currentPage, itemsPerPageState]);

  // Detect new images (images created in the last 24 hours)
  useEffect(() => {
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    const newIds = new Set<string>();

    processedImages.forEach((img) => {
      if (
        img.createdAt &&
        new Date(img.createdAt).getTime() > twentyFourHoursAgo
      ) {
        newIds.add(img.id);
      }
    });

    setNewImageIds((prevNewImageIds) => {
      if (
        newIds.size !== prevNewImageIds.size ||
        ![...newIds].every((id) => prevNewImageIds.has(id))
      ) {
        return newIds;
      }
      return prevNewImageIds;
    });
  }, [processedImages]);

  // Load more images
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);

    // Simulate loading delay for smooth UX
    await new Promise((resolve) => setTimeout(resolve, 500));

    setCurrentPage((prev) => prev + 1);
    setIsLoading(false);
  }, [isLoading, hasMore]);

  // Reset pagination
  const resetPagination = useCallback(() => {
    setCurrentPage(1);
    setIsLoading(false);
  }, []);

  // Go to specific page
  const goToPage = useCallback(
    (page: number) => {
      if (page >= 1 && page <= totalPages) {
        setCurrentPage(page);
      }
    },
    [totalPages],
  );

  // Set items per page
  const setItemsPerPage = useCallback(
    (count: number) => {
      setItemsPerPageState(count);
      resetPagination();
    },
    [resetPagination],
  );

  // Mark images as viewed (clear new badges)
  const markImagesAsViewed = useCallback(() => {
    setNewImageIds(new Set());
  }, []);

  return {
    // Data
    paginatedImages,
    allImages: processedImages,

    // Pagination state
    currentPage,
    totalPages,
    totalImages,
    hasMore,
    isLoading,

    // Actions
    loadMore,
    resetPagination,
    goToPage,
    setItemsPerPage,

    // New image detection
    newImageIds,
    markImagesAsViewed,
  };
}
