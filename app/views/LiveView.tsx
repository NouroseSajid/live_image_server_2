"use client";

import { useImageEvents } from "@/app/hooks/useImageEvents";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import ImageGrid from "../components/gallery/ImageGrid";
import LoadingSpinner from "../components/gallery/LoadingSpinner";
import ModernLightbox from "../components/gallery/ModernLightbox";

interface ProcessingImage {
  id: string;
  fileName: string;
  progress: number;
}

export default function LiveView() {
  const [images, setImages] = useState([]);
  const [processingImages, setProcessingImages] = useState<ProcessingImage[]>(
    [],
  );
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Use our SSE hook
  useImageEvents({
    onImageUpdate: (newImages) => {
      setImages((prev) => {
        // Only update if we have new images
        if (newImages.some((img) => !prev.find((p) => p.id === img.id))) {
          return [...newImages, ...prev];
        }
        return prev;
      });
    },
    onProcessingUpdate: (status) => {
      setProcessingImages(status.processingImages);
    },
  });

  // Initial load
  useEffect(() => {
    fetchImages();
  }, []);

  const fetchImages = async () => {
    try {
      const res = await fetch("/api/images/live");
      if (res.ok) {
        const data = await res.json();
        setImages(data);
      }
    } catch (error) {
      console.error("Error fetching images:", error);
    }
  };

  const slides = images.map((img) => ({
    src:
      img.variants.find((v) => v.name === "webp")?.path ||
      img.variants[0]?.path,
    alt: img.fileName,
  }));

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      {/* Processing Images Status */}
      <AnimatePresence>
        {processingImages.length > 0 && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-0 left-0 right-0 bg-black/80 backdrop-blur-sm z-50"
          >
            <div className="container mx-auto p-4">
              <div className="flex items-center gap-4">
                <LoadingSpinner size="sm" />
                <div>
                  <p className="font-medium">
                    Processing {processingImages.length} images...
                  </p>
                  <div className="flex gap-2 text-sm text-gray-400">
                    {processingImages.map((img) => (
                      <span key={img.id}>
                        {img.fileName} ({img.progress}%)
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8">Live Gallery</h1>

        <ImageGrid
          images={images}
          onImageClick={(index) => {
            setCurrentIndex(index);
            setLightboxOpen(true);
          }}
        />

        <AnimatePresence>
          {lightboxOpen && (
            <ModernLightbox
              slides={slides}
              currentIndex={currentIndex}
              setCurrentIndex={setCurrentIndex}
              setOpen={setLightboxOpen}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
