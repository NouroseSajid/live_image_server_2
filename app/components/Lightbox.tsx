"use client";

import NextImage from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { BiChevronLeft, BiChevronRight } from "react-icons/bi";
import { MdClose, MdDownload, MdVolumeOff, MdVolumeUp } from "react-icons/md";

interface ImageData {
  id: string;
  width: number;
  height: number;
  url: string;
  originalUrl?: string;
  category: string;
  title: string;
  meta: string;
  mimeType?: string; // Added for proper media type detection
}

interface LightboxProps {
  image: ImageData | null;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  nextImage?: ImageData | null;
  prevImage?: ImageData | null;
}

interface DownloadModalProps {
  onDownload: (quality: string) => void;
  onCancel: () => void;
  onSavePreference: (save: boolean) => void;
}

function DownloadModal({
  onDownload,
  onCancel,
  onSavePreference,
}: DownloadModalProps) {
  return (
    <div className="absolute top-16 right-0 bg-zinc-800 rounded-lg shadow-lg p-4 z-20">
      <p className="text-white text-sm mb-2">Choose download quality:</p>
      <div className="flex flex-col gap-2">
        <button
          onClick={() => onDownload("original")}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          Highest Quality
        </button>
        <button
          onClick={() => onDownload("webp")}
          className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
        >
          Medium
        </button>
      </div>
      <div className="mt-4 flex items-center">
        <input
          type="checkbox"
          id="save-preference"
          onChange={(e) => onSavePreference(e.target.checked)}
          className="mr-2"
        />
        <label htmlFor="save-preference" className="text-white text-xs">
          Save my choice
        </label>
      </div>
      <button
        onClick={onCancel}
        className="mt-4 text-white text-xs hover:underline"
      >
        Cancel
      </button>
    </div>
  );
}

export default function Lightbox({
  image,
  onClose,
  onNext,
  onPrev,
  nextImage,
  prevImage,
}: LightboxProps) {
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [savePreference, setSavePreference] = useState(false);
  const touchStartXRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(true);

  // Detect if media is a video
  const isVideo = useMemo(() => {
    return (
      image?.mimeType?.startsWith("video/") ||
      image?.url?.match(/\.(mp4|webm|ogg|mov)$/i) ||
      image?.originalUrl?.match(/\.(mp4|webm|ogg|mov)$/i)
    );
  }, [image?.mimeType, image?.url, image?.originalUrl]);

  // Reset media state when image changes
  useEffect(() => {
    setIsMuted(true);
  }, []);

  // Preload neighboring images (images only, skip videos)
  useEffect(() => {
    const candidates = [image, nextImage, prevImage].filter(Boolean) as ImageData[];
    const loaders: HTMLImageElement[] = [];

    candidates.forEach((item) => {
      const isVideo =
        item.mimeType?.startsWith("video/") ||
        item.url.match(/\.(mp4|webm|ogg|mov)$/i) ||
        item.originalUrl?.match(/\.(mp4|webm|ogg|mov)$/i);
      if (isVideo) return;
      const src = item.originalUrl || item.url;
      if (!src) return;
      if (typeof window === "undefined" || !window.Image) return;
      const img = new window.Image();
      img.src = src;
      loaders.push(img);
    });

    return () => {
      loaders.forEach((img) => {
        img.src = "";
      });
    };
  }, [image, nextImage, prevImage]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowLeft":
          onPrev();
          break;
        case "ArrowRight":
          onNext();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onNext, onPrev]);

  const handleDownloadClick = () => {
    const savedPreference = localStorage.getItem("downloadPreference");
    if (savedPreference) {
      triggerDownload(savedPreference);
    } else {
      setShowDownloadModal(true);
    }
  };

  const triggerDownload = (quality: string) => {
    if (savePreference) {
      localStorage.setItem("downloadPreference", quality);
    }
    window.open(
      `/api/images/${image?.id}/download?quality=${quality}`,
      "_blank",
    );
    setShowDownloadModal(false);
  };

  // Handle swipe gestures for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartXRef.current = e.touches[0].clientX;
    }
  };

  const handleTouchMove = (_e: React.TouchEvent) => {
    // Intentionally empty; we only need start/end for swipe
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.changedTouches.length === 1) {
      const endX = e.changedTouches[0].clientX;
      handleSwipe(endX);
    }
  };

  const handleSwipe = (endX: number) => {
    const minSwipeDistance = 50;
    if (!touchStartXRef.current || !endX) return;

    const distance = touchStartXRef.current - endX;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      onNext();
    } else if (isRightSwipe) {
      onPrev();
    }
  };

  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    if (videoRef.current) {
      videoRef.current.muted = newMutedState;
    }
  };


  if (!image) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-2xl flex items-center justify-center animate-in fade-in duration-300">
      {/* Mobile Header */}
      <div className="absolute top-3 left-3 sm:top-6 sm:left-6 flex items-center gap-2 sm:gap-4 z-10 w-full sm:w-auto pr-12 sm:pr-0">
        <button
          onClick={onClose}
          className="p-2 sm:p-3 bg-white/10 hover:bg-white/20 rounded-lg sm:rounded-full text-white transition-colors flex-shrink-0"
          title="Close"
        >
          <MdClose size={20} className="sm:w-6 sm:h-6" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-white font-bold text-sm sm:text-base truncate">
            {image.title}
          </h2>
          <p className="text-white/40 text-xs">{image.meta}</p>
        </div>
      </div>

      {/* Desktop Header - Hidden on Mobile */}
      <div className="absolute top-3 right-3 sm:top-6 sm:right-6 flex items-center gap-2 z-10">
        <div className="relative">
          <button
            onClick={handleDownloadClick}
            className="p-2 sm:p-3 bg-white/10 hover:bg-white/20 rounded-lg sm:rounded-xl text-white flex items-center gap-2 transition-colors flex-shrink-0"
            title="Download"
          >
            <MdDownload size={20} />
            <span className="text-sm font-medium hidden sm:inline">
              Download
            </span>
          </button>
          {showDownloadModal && (
            <DownloadModal
              onDownload={triggerDownload}
              onCancel={() => setShowDownloadModal(false)}
              onSavePreference={setSavePreference}
            />
          )}
        </div>
      </div>

      {/* Navigation Buttons - Smaller on Mobile */}
      <button
        onClick={onPrev}
        className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 p-2 sm:p-4 bg-white/5 hover:bg-white/10 rounded-lg sm:rounded-full text-white transition-all hover:scale-110 flex-shrink-0"
        title="Previous image"
      >
        <BiChevronLeft size={24} className="sm:w-8 sm:h-8" />
      </button>
      <button
        onClick={onNext}
        className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 p-2 sm:p-4 bg-white/5 hover:bg-white/10 rounded-lg sm:rounded-full text-white transition-all hover:scale-110 flex-shrink-0"
        title="Next image"
      >
        <BiChevronRight size={24} className="sm:w-8 sm:h-8" />
      </button>

      {/* Media Container */}
      <div
        className="relative max-w-[95vw] sm:max-w-[90vw] max-h-[75vh] sm:max-h-[85vh] group px-4 sm:px-0 mt-12 sm:mt-0 overflow-hidden touch-none"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {isVideo ? (
          <>
            <video
              ref={videoRef}
              src={image.originalUrl || image.url}
              className="max-w-full max-h-[calc(100vh-100px)] sm:max-h-[calc(100vh-120px)] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-500"
              autoPlay
              loop
              muted={isMuted}
              playsInline
              controls={false}
            />
            {/* Volume Toggle for Videos */}
            <button
              onClick={toggleMute}
              className="absolute bottom-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-10"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <MdVolumeOff size={24} /> : <MdVolumeUp size={24} />}
            </button>
          </>
        ) : (
          <div className="relative">
            <NextImage
              src={image.originalUrl || image.url}
              alt={image.title || "Preview"}
              width={image.width || 1920}
              height={image.height || 1080}
              className="max-w-full max-h-[calc(100vh-100px)] sm:max-h-[calc(100vh-120px)] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-500"
              unoptimized
            />
          </div>
        )}
      </div>

      {/* Swipe hint on mobile */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/40 text-xs sm:hidden">
        Swipe left or right to navigate
      </div>
    </div>
  );
}
