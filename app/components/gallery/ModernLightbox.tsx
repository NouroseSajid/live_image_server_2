'use client';

import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface Slide {
  src: string;
  alt: string;
  rotation?: number;
}

interface LightboxProps {
  slides: Slide[];
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  setOpen: (open: boolean) => void;
  batchSize?: number;
  onLoadMore?: () => void;
}

const ModernLightbox: React.FC<LightboxProps> = ({
  slides,
  currentIndex,
  setCurrentIndex,
  setOpen,
  batchSize = 50,
  onLoadMore
}) => {
  const touchStartX = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const endX = e.changedTouches[0].clientX;
    const diff = endX - touchStartX.current;
    if (Math.abs(diff) > 50) {
      if (diff < 0) setCurrentIndex((i) => (i < slides.length - 1 ? i + 1 : 0));
      else setCurrentIndex((i) => (i > 0 ? i - 1 : slides.length - 1));
    }
    touchStartX.current = null;
  };

  // Check if we need to load more images when approaching the end
  useEffect(() => {
    if (onLoadMore && currentIndex >= slides.length - 5) {
      onLoadMore();
    }
  }, [currentIndex, slides.length, onLoadMore]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
      if (e.key === 'ArrowLeft') setCurrentIndex((i) => (i > 0 ? i - 1 : slides.length - 1));
      if (e.key === 'ArrowRight') setCurrentIndex((i) => (i < slides.length - 1 ? i + 1 : 0));
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setOpen, setCurrentIndex, slides.length]);

  const rotation = slides[currentIndex]?.rotation || 0;

  return (
    <motion.div
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => {
        if (e.target === containerRef.current) setOpen(false);
      }}
    >
      <motion.img
        key={slides[currentIndex]?.src}
        src={slides[currentIndex]?.src}
        alt={slides[currentIndex]?.alt}
        className="max-h-[90vh] max-w-[90vw] rounded-xl shadow-2xl object-contain cursor-grab active:cursor-grabbing"
        style={{ transform: `rotate(${rotation}deg)` }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", duration: 0.3 }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => e.stopPropagation()}
      />

      <motion.button
        className="absolute top-6 right-8 z-50 p-3 rounded-full bg-black/50 backdrop-blur-sm text-white/90 hover:bg-black/70 transition-colors"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen(false)}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </motion.button>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4">
        <motion.button
          className="p-3 rounded-full bg-black/50 backdrop-blur-sm text-white/90 hover:bg-black/70 transition-colors"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setCurrentIndex((i) => (i > 0 ? i - 1 : slides.length - 1))}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </motion.button>

        <div className="px-4 py-2 rounded-full bg-black/50 backdrop-blur-sm text-white/90">
          {slides[currentIndex]?.alt}
        </div>

        <motion.button
          className="p-3 rounded-full bg-black/50 backdrop-blur-sm text-white/90 hover:bg-black/70 transition-colors"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setCurrentIndex((i) => (i < slides.length - 1 ? i + 1 : 0))}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </motion.button>
      </div>
    </motion.div>
  );
};

export default ModernLightbox;