"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Slide {
  src: string;
  alt: string;
  rotation?: number;
  width?: number;
  height?: number;
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
  onLoadMore,
}) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const initialPinchDistance = useRef<number | null>(null);
  const initialScale = useRef(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Reset zoom when image changes
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [currentIndex]);

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

  const currentSlide = slides[currentIndex];
  const rotationDegrees = exifOrientationToDegrees(currentSlide?.rotation || 1);

  // Calculate if dimensions should be swapped
  const dimensionsSwapped = rotationDegrees === 90 || rotationDegrees === 270;

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY * -0.01;
    const newScale = Math.min(Math.max(1, scale + delta), 5);
    setScale(newScale);
    if (newScale === 1) {
      setPosition({ x: 0, y: 0 });
    }
  };

  const getPinchDistance = (touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Pinch zoom
      initialPinchDistance.current = getPinchDistance(e.touches);
      initialScale.current = scale;
    } else if (e.touches.length === 1) {
      // Single touch for swipe
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;

      if (scale > 1) {
        setIsDragging(true);
        setDragStart({
          x: e.touches[0].clientX - position.x,
          y: e.touches[0].clientY - position.y,
        });
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistance.current !== null) {
      // Pinch zoom
      e.preventDefault();
      const currentDistance = getPinchDistance(e.touches);
      const scaleChange = currentDistance / initialPinchDistance.current;
      const newScale = Math.min(
        Math.max(1, initialScale.current * scaleChange),
        5,
      );
      setScale(newScale);
      if (newScale === 1) {
        setPosition({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1 && scale > 1 && isDragging) {
      // Pan when zoomed
      e.preventDefault();
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      initialPinchDistance.current = null;
    }

    if (e.touches.length === 0) {
      setIsDragging(false);

      if (
        touchStartX.current !== null &&
        touchStartY.current !== null &&
        scale === 1
      ) {
        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        const diffX = endX - touchStartX.current;
        const diffY = Math.abs(
          e.changedTouches[0].clientY - touchStartY.current,
        );

        // Only swipe if horizontal movement is significant and vertical is minimal
        if (Math.abs(diffX) > 50 && diffY < 50) {
          if (diffX < 0) {
            setCurrentIndex((i) => (i < slides.length - 1 ? i + 1 : 0));
          } else {
            setCurrentIndex((i) => (i > 0 ? i - 1 : slides.length - 1));
          }
        }
      }

      touchStartX.current = null;
      touchStartY.current = null;
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Check if we need to load more images when approaching the end
  useEffect(() => {
    if (onLoadMore && currentIndex >= slides.length - 5) {
      onLoadMore();
    }
  }, [currentIndex, slides.length, onLoadMore]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (scale > 1) {
          setScale(1);
          setPosition({ x: 0, y: 0 });
        } else {
          setOpen(false);
        }
      }
      if (e.key === "ArrowLeft" && scale === 1)
        setCurrentIndex((i) => (i > 0 ? i - 1 : slides.length - 1));
      if (e.key === "ArrowRight" && scale === 1)
        setCurrentIndex((i) => (i < slides.length - 1 ? i + 1 : 0));
      if (e.key === "+" || e.key === "=") {
        setScale((s) => Math.min(s + 0.5, 5));
      }
      if (e.key === "-" || e.key === "_") {
        const newScale = Math.max(scale - 0.5, 1);
        setScale(newScale);
        if (newScale === 1) setPosition({ x: 0, y: 0 });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setOpen, setCurrentIndex, slides.length, scale]);

  return (
    <motion.div
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => {
        if (e.target === containerRef.current && scale === 1) setOpen(false);
      }}
      onWheel={handleWheel}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={currentSlide?.src}
          className="relative flex items-center justify-center w-full h-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <img
            ref={imageRef}
            src={currentSlide?.src}
            alt={currentSlide?.alt}
            className="max-h-[96vh] max-w-[96vw] rounded-lg shadow-2xl object-contain select-none"
            style={{
              transform: `rotate(${rotationDegrees}deg) scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
              cursor:
                scale > 1 ? (isDragging ? "grabbing" : "grab") : "default",
              transition: isDragging ? "none" : "transform 0.1s ease-out",
              // Ensure rotated images fit properly
              ...(dimensionsSwapped
                ? {
                    maxWidth: "96vh",
                    maxHeight: "96vw",
                  }
                : {}),
            }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onClick={(e) => e.stopPropagation()}
            draggable={false}
          />
        </motion.div>
      </AnimatePresence>

      {/* Close button */}
      <motion.button
        className="absolute top-6 right-6 z-50 p-3 rounded-full bg-black/50 backdrop-blur-sm text-white/90 hover:bg-black/70 transition-colors"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen(false)}
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </motion.button>

      {/* Zoom controls */}
      <div className="absolute top-6 left-6 z-50 flex flex-col gap-2">
        <motion.button
          className="p-3 rounded-full bg-black/50 backdrop-blur-sm text-white/90 hover:bg-black/70 transition-colors"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setScale((s) => Math.min(s + 0.5, 5))}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 4v16m8-8H4"
            />
          </svg>
        </motion.button>

        <div className="px-3 py-2 rounded-full bg-black/50 backdrop-blur-sm text-white/90 text-sm font-medium text-center">
          {Math.round(scale * 100)}%
        </div>

        <motion.button
          className="p-3 rounded-full bg-black/50 backdrop-blur-sm text-white/90 hover:bg-black/70 transition-colors disabled:opacity-50"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => {
            const newScale = Math.max(scale - 0.5, 1);
            setScale(newScale);
            if (newScale === 1) setPosition({ x: 0, y: 0 });
          }}
          disabled={scale === 1}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M20 12H4"
            />
          </svg>
        </motion.button>
      </div>

      {/* Navigation controls */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4">
        <motion.button
          className="p-3 rounded-full bg-black/50 backdrop-blur-sm text-white/90 hover:bg-black/70 transition-colors"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() =>
            setCurrentIndex((i) => (i > 0 ? i - 1 : slides.length - 1))
          }
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </motion.button>

        <div className="px-4 py-2 rounded-full bg-black/50 backdrop-blur-sm text-white/90 text-sm">
          {currentIndex + 1} / {slides.length}
        </div>

        <motion.button
          className="p-3 rounded-full bg-black/50 backdrop-blur-sm text-white/90 hover:bg-black/70 transition-colors"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() =>
            setCurrentIndex((i) => (i < slides.length - 1 ? i + 1 : 0))
          }
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </motion.button>
      </div>

      {/* Instructions hint */}
      {scale === 1 && (
        <motion.div
          className="absolute bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-black/30 backdrop-blur-sm text-white/70 text-xs"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
        >
          Scroll to zoom • Swipe to navigate
        </motion.div>
      )}
    </motion.div>
  );
};

export default ModernLightbox;
