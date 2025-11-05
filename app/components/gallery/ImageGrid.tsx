'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Image {
  id: string;
  fileName: string;
  folderId: string;
  variants: { name: string; path: string }[];
}

interface ImageGridProps {
  images: Image[];
  onImageClick: (index: number) => void;
  batchSize?: number;
}

const ImageGrid: React.FC<ImageGridProps> = ({ 
  images, 
  onImageClick, 
  batchSize = 50 
}) => {
  const [displayCount, setDisplayCount] = useState(batchSize);
  const [isLoading, setIsLoading] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadMoreImages = () => {
      setIsLoading(true);
      setTimeout(() => {
        setDisplayCount(prev => Math.min(prev + batchSize, images.length));
        setIsLoading(false);
      }, 500); // Simulate loading delay
    };

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && displayCount < images.length) {
          loadMoreImages();
        }
      },
      { threshold: 0.5 }
    );

    if (loadingRef.current) {
      observerRef.current.observe(loadingRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [displayCount, images.length, batchSize]);

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 p-4 w-[95%] mx-auto">
        <AnimatePresence>
          {images.slice(0, displayCount).map((image, index) => (
            <motion.div
              key={image.id}
              className="relative group cursor-pointer"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.2 }}
              onClick={() => onImageClick(index)}
            >
              <div className="aspect-w-16 aspect-h-12">
                <img
                  src={image.variants.find(v => v.name === 'thumbnail')?.path || '/placeholder-image.jpg'}
                  alt={image.fileName}
                  className="w-full h-full object-cover rounded-xl shadow-lg border border-gray-200/10"
                  loading="lazy"
                />
              </div>
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-xl flex items-center justify-center">
                <p className="text-white text-sm font-medium px-4 py-2 bg-black/60 rounded-lg transform translate-y-2 group-hover:translate-y-0 transition-transform duration-200">
                  View Image
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      
      {displayCount < images.length && (
        <div
          ref={loadingRef}
          className="w-full flex justify-center items-center py-8"
        >
          <motion.div
            className="w-12 h-12 border-4 border-gray-300 border-t-gray-800 rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
        </div>
      )}
    </div>
  );
};

export default ImageGrid;