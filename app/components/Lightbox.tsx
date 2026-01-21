"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

/* ---------- TYPES ---------- */
interface ImageData {
  id: string;
  width: number;
  height: number;
  url: string;
  originalUrl?: string;
  category: string;
  title: string;
  meta: string;
  mimeType?: string;
}

interface LightboxProps {
  image: ImageData | null;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  nextImage?: ImageData | null;
  prevImage?: ImageData | null;
}

/* ---------- CONFIG ---------- */
const ANIM_MS = 280;
const SWIPE_THRESHOLD = 0.15;
const RUBBERBAND = 50;

/* ---------- HELPERS ---------- */
const isVideo = (item?: ImageData | null) => {
  if (!item) return false;
  return (
    item.mimeType?.startsWith("video/") ||
    /\/(mp4|webm|ogg|mov)$/i.test(item.url || "") ||
    /\/(mp4|webm|ogg|mov)$/i.test(item.originalUrl || "")
  );
};

/* ---------- ICONS ---------- */
const CloseIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
  </svg>
);

const ChevronLeftIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 18l6-6-6-6" />
  </svg>
);

const VolumeOffIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" />
  </svg>
);

const VolumeUpIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
  </svg>
);

/* ---------- DOWNLOAD MODAL ---------- */
interface DownloadModalProps {
  onDownload: (q: string) => void;
  onCancel: () => void;
  onSavePreference: (v: boolean) => void;
}
const DownloadModal = ({
  onDownload,
  onCancel,
  onSavePreference,
}: DownloadModalProps) => (
  <div className="absolute top-16 right-0 bg-zinc-800 rounded-lg shadow-lg p-4 z-20 w-64">
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
        id="save-preference"
        type="checkbox"
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

/* ---------- MEDIA ITEM ---------- */
const MediaItem = ({
  item,
  isMuted,
  videoRef,
  isActive,
}: {
  item: ImageData;
  isMuted: boolean;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  isActive: boolean;
}) => {
  const src = item.originalUrl || item.url;
  if (isVideo(item)) {
    return (
      <video
        ref={isActive ? videoRef : undefined}
        src={src}
        className="max-w-full max-h-[calc(100vh-100px)] sm:max-h-[calc(100vh-120px)] object-contain rounded-lg shadow-2xl"
        autoPlay={isActive}
        loop
        muted={isMuted}
        playsInline
        controls={false}
      />
    );
  }
  return (
    <img
      src={src}
      alt={item.title || "Preview"}
      className="max-w-full max-h-[calc(100vh-100px)] sm:max-h-[calc(100vh-120px)] object-contain rounded-lg shadow-2xl"
      loading={isActive ? "eager" : "lazy"}
    />
  );
};

/* ---------- MAIN LIGHTBOX ---------- */
export default function Lightbox({
  image,
  onClose,
  onNext,
  onPrev,
  nextImage,
  prevImage,
}: LightboxProps) {
  /* ---------- STATE ---------- */
  const [showDL, setShowDL] = useState(false);
  const [savePref, setSavePref] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [dragOffset, setDragOffset] = useState(0);
  const [width, setWidth] = useState(0);
  const [mounted, setMounted] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const touchStartXRef = useRef(0);
  const isAnimatingRef = useRef(false);
  const shouldTransitionRef = useRef(true);

  /* ---------- LIFECYCLE ---------- */
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const update = () => setWidth(window.innerWidth);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Reset mute when image changes
  useEffect(() => {
    setIsMuted(true);
  }, [image?.id]);

  /* ---------- PRELOAD ---------- */
  useEffect(() => {
    if (typeof window === "undefined") return;
    [nextImage, prevImage].forEach((item) => {
      if (!item || isVideo(item)) return;
      const img = new Image();
      img.src = item.originalUrl || item.url;
    });
  }, [nextImage, prevImage]);

  /* ---------- FOCUS TRAP + SCROLL LOCK ---------- */
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = Array.from(
      root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    first?.focus();
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener("keydown", handleTab);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", handleTab);
    };
  }, []);

  /* ---------- STABLE CALLBACK REFS ---------- */
  const cbRef = useRef({ onClose, onNext, onPrev });
  useEffect(() => {
    cbRef.current = { onClose, onNext, onPrev };
  });

  /* ---------- NAVIGATION ---------- */
  const handleNext = useCallback(() => {
    if (isAnimatingRef.current || !nextImage) return;
    isAnimatingRef.current = true;
    
    // Slide out
    shouldTransitionRef.current = true;
    setDragOffset(-width);
    
    // After slide completes, update image and reset position instantly
    setTimeout(() => {
      cbRef.current.onNext();
      shouldTransitionRef.current = false;
      setDragOffset(0);
      // Small delay to ensure the position reset happens before re-enabling transitions
      setTimeout(() => {
        shouldTransitionRef.current = true;
        isAnimatingRef.current = false;
      }, 50);
    }, ANIM_MS);
  }, [nextImage, width]);

  const handlePrev = useCallback(() => {
    if (isAnimatingRef.current || !prevImage) return;
    isAnimatingRef.current = true;
    
    // Slide out
    shouldTransitionRef.current = true;
    setDragOffset(width);
    
    // After slide completes, update image and reset position instantly
    setTimeout(() => {
      cbRef.current.onPrev();
      shouldTransitionRef.current = false;
      setDragOffset(0);
      // Small delay to ensure the position reset happens before re-enabling transitions
      setTimeout(() => {
        shouldTransitionRef.current = true;
        isAnimatingRef.current = false;
      }, 50);
    }, ANIM_MS);
  }, [prevImage, width]);

  /* ---------- TOUCH HANDLERS ---------- */
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isAnimatingRef.current) return;
    if (e.touches.length === 1) {
      touchStartXRef.current = e.touches[0].clientX;
      isDraggingRef.current = true;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDraggingRef.current || isAnimatingRef.current) return;
    const dx = e.touches[0].clientX - touchStartXRef.current;
    const max = width * 0.5;
    let clamped = dx;
    if (dx > 0 && !prevImage) clamped = Math.min(dx, RUBBERBAND);
    else if (dx < 0 && !nextImage) clamped = Math.max(dx, -RUBBERBAND);
    else clamped = Math.max(-max, Math.min(max, dx));
    setDragOffset(clamped);
  }, [width, prevImage, nextImage]);

  const handleTouchEnd = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    const threshold = width * SWIPE_THRESHOLD;

    if (dragOffset > threshold && prevImage) {
      isAnimatingRef.current = true;
      shouldTransitionRef.current = true;
      setDragOffset(width);
      
      setTimeout(() => {
        cbRef.current.onPrev();
        shouldTransitionRef.current = false;
        setDragOffset(0);
        setTimeout(() => {
          shouldTransitionRef.current = true;
          isAnimatingRef.current = false;
        }, 50);
      }, ANIM_MS);
    } else if (dragOffset < -threshold && nextImage) {
      isAnimatingRef.current = true;
      shouldTransitionRef.current = true;
      setDragOffset(-width);
      
      setTimeout(() => {
        cbRef.current.onNext();
        shouldTransitionRef.current = false;
        setDragOffset(0);
        setTimeout(() => {
          shouldTransitionRef.current = true;
          isAnimatingRef.current = false;
        }, 50);
      }, ANIM_MS);
    } else {
      // Snap back
      shouldTransitionRef.current = true;
      setDragOffset(0);
    }
  }, [width, dragOffset, prevImage, nextImage]);

  /* ---------- KEYBOARD ---------- */
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    )
      return;
    switch (e.key) {
      case "Escape":
        cbRef.current.onClose();
        break;
      case "ArrowLeft":
        handlePrev();
        break;
      case "ArrowRight":
        handleNext();
        break;
    }
  }, [handlePrev, handleNext]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  /* ---------- DOWNLOAD ---------- */
  const handleDownloadClick = () => {
    if (!mounted) return;
    const saved = localStorage.getItem("downloadPreference");
    if (saved) triggerDownload(saved);
    else setShowDL(true);
  };
  const triggerDownload = (quality: string) => {
    if (savePref) localStorage.setItem("downloadPreference", quality);
    window.open(`/api/images/${image?.id}/download?quality=${quality}`, "_blank");
    setShowDL(false);
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (videoRef.current) videoRef.current.muted = next;
  };

  /* ---------- RENDER ---------- */
  if (!image || !width) return null;

  const activeTranslate = dragOffset;
  const prevTranslate = -width + dragOffset;
  const nextTranslate = width + dragOffset;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-2xl flex items-center justify-center animate-in fade-in duration-300"
    >
      {/* ------ HEADER ------ */}
      <div className="absolute top-3 left-3 sm:top-6 sm:left-6 flex items-center gap-2 sm:gap-4 z-20 w-full sm:w-auto pr-12 sm:pr-0">
        <button
          aria-label="Close lightbox"
          onClick={onClose}
          className="p-2 sm:p-3 bg-white/10 hover:bg-white/20 rounded-lg sm:rounded-full text-white transition-colors flex-shrink-0"
        >
          <CloseIcon />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-white font-bold text-sm sm:text-base truncate">
            {image.title}
          </h2>
          <p className="text-white/40 text-xs">{image.meta}</p>
        </div>
      </div>

      {/* ------ DOWNLOAD ------ */}
      <div className="absolute top-3 right-3 sm:top-6 sm:right-6 z-20">
        <button
          aria-label="Download image"
          onClick={handleDownloadClick}
          className="p-2 sm:p-3 bg-white/10 hover:bg-white/20 rounded-lg sm:rounded-xl text-white flex items-center gap-2 transition-colors"
        >
          <DownloadIcon />
          <span className="text-sm font-medium hidden sm:inline">Download</span>
        </button>
        {showDL && (
          <DownloadModal
            onDownload={triggerDownload}
            onCancel={() => setShowDL(false)}
            onSavePreference={setSavePref}
          />
        )}
      </div>

      {/* ------ NAV BUTTONS ------ */}
      <button
        aria-label="Previous image"
        onClick={handlePrev}
        disabled={!prevImage}
        className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 p-2 sm:p-4 bg-white/5 hover:bg-white/10 rounded-lg sm:rounded-full text-white transition transform-gpu hover:scale-110 disabled:opacity-30 disabled:hover:scale-100 z-20"
      >
        <ChevronLeftIcon />
      </button>
      <button
        aria-label="Next image"
        onClick={handleNext}
        disabled={!nextImage}
        className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 p-2 sm:p-4 bg-white/5 hover:bg-white/10 rounded-lg sm:rounded-full text-white transition transform-gpu hover:scale-110 disabled:opacity-30 disabled:hover:scale-100 z-20"
      >
        <ChevronRightIcon />
      </button>

      {/* ------ CAROUSEL ------ */}
      <div
        className="relative w-full h-full flex items-center justify-center overflow-hidden touch-pan-y"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Prev */}
        {prevImage && (
          <div
            className="absolute flex items-center justify-center px-4 sm:px-16 will-change-transform"
            style={{
              width,
              transform: `translateX(${prevTranslate}px)`,
              transition: isDraggingRef.current || !shouldTransitionRef.current
                ? "none"
                : `transform ${ANIM_MS}ms cubic-bezier(0.25,0.1,0.25,1)`,
            }}
          >
            <MediaItem item={prevImage} isMuted={true} isActive={false} />
          </div>
        )}

        {/* Current */}
        <div
          className="absolute flex items-center justify-center px-4 sm:px-16 will-change-transform"
          style={{
            width,
            transform: `translateX(${activeTranslate}px)`,
            transition: isDraggingRef.current || !shouldTransitionRef.current
              ? "none"
              : `transform ${ANIM_MS}ms cubic-bezier(0.25,0.1,0.25,1)`,
          }}
        >
          <MediaItem
            item={image}
            isMuted={isMuted}
            videoRef={videoRef}
            isActive={true}
          />
          {isVideo(image) && (
            <button
              aria-label={isMuted ? "Unmute video" : "Mute video"}
              onClick={toggleMute}
              className="absolute bottom-20 right-8 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors z-30"
            >
              {isMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
            </button>
          )}
        </div>

        {/* Next */}
        {nextImage && (
          <div
            className="absolute flex items-center justify-center px-4 sm:px-16 will-change-transform"
            style={{
              width,
              transform: `translateX(${nextTranslate}px)`,
              transition: isDraggingRef.current || !shouldTransitionRef.current
                ? "none"
                : `transform ${ANIM_MS}ms cubic-bezier(0.25,0.1,0.25,1)`,
            }}
          >
            <MediaItem item={nextImage} isMuted={true} isActive={false} />
          </div>
        )}
      </div>

      {/* ------ LIVE REGION + HINT ------ */}
      <div aria-live="polite" className="sr-only">
        {image.title} ({image.id})
      </div>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/60 text-xs sm:hidden">
        Swipe to navigate
      </div>
    </div>
  );
}