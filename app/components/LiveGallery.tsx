"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";
import type { Image as GalleryImage } from "../types/gallery";
import { ImageSkeletonGrid } from "./ImageSkeleton";
import JustifiedPhotoGrid from "./gallery/JustifiedPhotoGrid";

export function LiveGallery() {
  const [liveImages, setLiveImages] = useState<GalleryImage[]>([]);
  const [latestImage, setLatestImage] = useState<GalleryImage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [newImageIds, setNewImageIds] = useState<Set<string>>(new Set());
  const batchSize = 50;

  const galleryRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0.1,
    root: galleryRef.current,
    rootMargin: "200px",
  });

  useEffect(() => {
    if (inView && !isLoading && hasMore) {
      handleLoadMore();
    }
  }, [inView, isLoading, hasMore]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    const ws = new WebSocket("ws://localhost:8080");
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[WS] Connected to live updates");
      setWsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "new-file") {
          const newImage = message.payload as GalleryImage;

          // Add the new image to the top of the gallery
          setLiveImages((prevImages) => {
            // Avoid duplicates
            const exists = prevImages.some((img) => img.id === newImage.id);
            if (exists) return prevImages;
            return [newImage, ...prevImages];
          });

          // Track this as a new image for visual feedback (badge)
          setNewImageIds((prev) => new Set([...prev, newImage.id]));

          // Remove "NEW" badge after 5 seconds
          setTimeout(() => {
            setNewImageIds((prev) => {
              const updated = new Set(prev);
              updated.delete(newImage.id);
              return updated;
            });
          }, 5000);

          // Update the latest image for the background
          setLatestImage(newImage);
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    ws.onclose = () => {
      console.log("[WS] Disconnected from live updates");
      setWsConnected(false);
    };

    ws.onerror = (error) => {
      console.error("[WS] WebSocket error:", error);
      setWsConnected(false);
    };

    // Cleanup on component unmount
    return () => {
      ws.close();
    };
  }, []);

  const handleLoadMore = async () => {
    if (!isLoading) {
      await fetchLiveImages(page + 1);
    }
  };

  const fetchLiveImages = async (pageNum = 1, retries = 3) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/images/live?page=${pageNum}&limit=${batchSize}`,
      );
      if (res.ok) {
        const data: GalleryImage[] = await res.json();
        setHasMore(data.length === batchSize);

        if (pageNum === 1) {
          setLiveImages(data);
          if (data.length > 0) {
            setLatestImage(data[0]);
          }
        } else {
          setLiveImages((prev) => [...prev, ...data]);
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
        setTimeout(
          () => {
            setRetryCount((prev) => prev + 1);
            fetchLiveImages(pageNum, retries - 1);
          },
          Math.min(1000 * (4 - retries), 3000),
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveImages();
  }, []);

  return (
    <div className="relative w-full">
      {/* Blurred background with latest image */}
      {latestImage && (
        <div
          className="absolute inset-0 bg-cover bg-center blur-lg opacity-50 transition-all duration-1000"
          style={{
            backgroundImage: `url(${
              latestImage.variants.find((v) => v.name === "webp")?.path ||
              "/placeholder-live-bg.jpg"
            })`,
          }}
        />
      )}

      <div className="relative z-10 flex flex-col items-center h-full text-white p-4">
        <div className="w-full mb-4 flex flex-col gap-2">
          <h2 className="text-4xl font-bold drop-shadow-lg">Live Gallery</h2>

          {/* Ingest Status Bar */}
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              wsConnected
                ? "bg-green-500/20 border border-green-500/50 text-green-300"
                : "bg-red-500/20 border border-red-500/50 text-red-300"
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                wsConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
              }`}
            />
            {wsConnected
              ? "🟢 Ingest watcher connected • Ready to receive images"
              : "🔴 Ingest watcher disconnected • Changes may not appear live"}
          </div>
        </div>

        <div
          ref={galleryRef}
          className="w-[95%] bg-black/30 shadow-lg rounded-xl p-4 mx-auto"
        >
          {error && (
            <div className="text-center py-4">
              <p className="text-red-400 mb-2">{error}</p>
              <button
                type="button"
                onClick={() => fetchLiveImages(page)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition"
              >
                Retry {retryCount > 0 ? `(${retryCount})` : ""}
              </button>
            </div>
          )}

          {liveImages.length === 0 && isLoading && <ImageSkeletonGrid />}

          {liveImages.length > 0 && (
            <>
              <h3 className="text-xl font-semibold mb-4 drop-shadow">
                All Images
              </h3>
              <JustifiedPhotoGrid
                images={liveImages}
                newImageIds={newImageIds}
              />
            </>
          )}

          {/* Load more trigger */}
          <div
            ref={loadMoreRef}
            className="h-20 flex items-center justify-center"
          >
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
