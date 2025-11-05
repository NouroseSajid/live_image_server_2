"use client";

import React, { useState, useEffect, useRef } from "react";
import { useInView } from "react-intersection-observer";
import { motion } from "framer-motion";
import { ImageSkeletonGrid } from "./ImageSkeleton";
import PhotoGrid from "./gallery/PhotoGrid";
import type { Image as GalleryImage } from "../types/gallery";

export function LiveGallery() {
  const [liveImages, setLiveImages] = useState<GalleryImage[]>([]);
  const [latestImage, setLatestImage] = useState<GalleryImage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const batchSize = 50;

  const galleryRef = useRef<HTMLDivElement | null>(null);

  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0.1,
    root: galleryRef.current,
    rootMargin: '200px',
  });

  useEffect(() => {
    if (inView && !isLoading && hasMore) {
      handleLoadMore();
    }
  }, [inView]);

  const handleLoadMore = async () => {
    if (!isLoading) {
      await fetchLiveImages(page + 1);
    }
  };

  const fetchLiveImages = async (pageNum = 1, retries = 3) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const res = await fetch(`/api/images/live?page=${pageNum}&limit=${batchSize}`);
      if (res.ok) {
        const data: GalleryImage[] = await res.json();
        setHasMore(data.length === batchSize);
        
        if (pageNum === 1) {
          setLiveImages(data);
          if (data.length > 0) {
            setLatestImage(data[0]);
          }
        } else {
          setLiveImages(prev => [...prev, ...data]);
        }
        setPage(pageNum);
        setRetryCount(0);
      } else {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
    } catch (error) {
      console.error("Error fetching images:", error);
      setError("Failed to load images. Please try again.");
      
      if (retries > 0) {
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          fetchLiveImages(pageNum, retries - 1);
        }, Math.min(1000 * (4 - retries), 3000));
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveImages();
  }, []);

  return (
    <div className="relative min-h-screen w-full">
      {/* Blurred background with latest image */}
      {latestImage && (
        <div
          className="absolute inset-0 bg-cover bg-center blur-lg opacity-50"
          style={{
            backgroundImage: `url(${
              latestImage.variants[0]?.path || "/placeholder-live-bg.jpg"
            })`,
          }}
        />
      )}

      <div className="relative z-10 flex flex-col items-center h-full text-white p-4">
        <h2 className="text-4xl font-bold mb-4 drop-shadow-lg">Live Gallery</h2>

        

        <div
          ref={galleryRef}
          className="w-[95%] bg-black/30 shadow-lg rounded-xl p-4 h-[calc(100vh-150px)] overflow-y-auto mx-auto"
        >
          {error && (
            <div className="text-center py-4">
              <p className="text-red-400 mb-2">{error}</p>
              <button
                onClick={() => fetchLiveImages(page)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition"
              >
                Retry {retryCount > 0 ? `(${retryCount})` : ''}
              </button>
            </div>
          )}
          
          {liveImages.length === 0 && isLoading && <ImageSkeletonGrid />}
          
          {liveImages.length > 0 && (
            <>
              <h3 className="text-xl font-semibold mb-4 drop-shadow">All Images</h3>
              <PhotoGrid images={liveImages} />
            </>
          )}

          {/* Load more trigger */}
          <div ref={loadMoreRef} className="h-20 flex items-center justify-center">
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center"
              >
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-2" />
                <p className="text-white text-sm">Loading more images...</p>
              </motion.div>
            )}
            {!isLoading && !hasMore && liveImages.length > 0 && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-gray-400 text-sm"
              >
                No more images to load
              </motion.p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}