"use client";

import NextImage from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { FiMail } from "react-icons/fi";
import { recordImageView } from "../lib/viewTracking";
import RawRequestModal from "./gallerycomponents/RawRequestModal";

/* ---------- TYPES ---------- */
interface ImageData {
  id: string;
  width: number;
  height: number;
  url: string;
  originalUrl?: string;
  videoUrl?: string;
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
  canNext?: boolean;
  isLoadingMore?: boolean;
  nextImage?: ImageData | null;
  prevImage?: ImageData | null;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  isDownloading?: boolean;
  passphrase?: string;
}

/* ---------- CONFIG ---------- */
const ANIM_MS = 280;
const SWIPE_THRESHOLD = 0.15;
const RUBBERBAND = 50;
const MAX_ZOOM = 4;
const DOUBLE_TAP_ZOOM = 2.5;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_SLOP = 30;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/* ---------- HELPERS ---------- */
const isVideo = (item?: ImageData | null) => {
  if (!item) return false;
  return (
    item.mimeType?.startsWith("video/") ||
    /\.(mp4|webm|ogg|ogv|mov|m4v)$/i.test(item.videoUrl || "") ||
    /\.(mp4|webm|ogg|ogv|mov|m4v)$/i.test(item.url || "") ||
    /\.(mp4|webm|ogg|ogv|mov|m4v)$/i.test(item.originalUrl || "")
  );
};

/* ---------- ICONS ---------- */
const CloseIcon = () => (
  <svg
    aria-hidden="true"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

const DownloadIcon = () => (
  <svg
    aria-hidden="true"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
  </svg>
);

const ChevronLeftIcon = () => (
  <svg
    aria-hidden="true"
    width="32"
    height="32"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg
    aria-hidden="true"
    width="32"
    height="32"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M9 18l6-6-6-6" />
  </svg>
);

const VolumeOffIcon = () => (
  <svg
    aria-hidden="true"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" />
  </svg>
);

const VolumeUpIcon = () => (
  <svg
    aria-hidden="true"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
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
        type="button"
        onClick={() => onDownload("original")}
        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
      >
        Highest Quality
      </button>
      <button
        type="button"
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
      type="button"
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
    <NextImage
      src={src}
      alt={item.title || "Preview"}
      width={item.width}
      height={item.height}
      unoptimized
      className="max-w-full max-h-[calc(100vh-100px)] sm:max-h-[calc(100vh-120px)] w-auto h-auto object-contain rounded-lg shadow-2xl"
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
  canNext = false,
  isLoadingMore = false,
  nextImage,
  prevImage,
  isSelected = false,
  onToggleSelect,
  isDownloading = false,
  passphrase,
}: LightboxProps) {
  /* ---------- STATE ---------- */
  const [showDL, setShowDL] = useState(false);
  const [showRequest, setShowRequest] = useState(false);
  const [savePref, setSavePref] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [dragOffset, setDragOffset] = useState(0);
  const [width, setWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 0,
  );
  const [height, setHeight] = useState(
    typeof window !== "undefined" ? window.innerHeight : 0,
  );
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoomAnimating, setZoomAnimating] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [localDownloading, setLocalDownloading] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const slideRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const touchStartXRef = useRef(0);
  const isAnimatingRef = useRef(false);
  const shouldTransitionRef = useRef(true);

  // Gesture state for pinch-zoom and panning.
  const pinchRef = useRef<{
    startDist: number;
    startZoom: number;
    startPan: { x: number; y: number };
    startMid: { x: number; y: number };
  } | null>(null);
  const panGestureRef = useRef<{
    startX: number;
    startY: number;
    startPan: { x: number; y: number };
  } | null>(null);
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(
    null,
  );
  const tapMovedRef = useRef(false);
  const zoomAnimTimerRef = useRef<number | null>(null);

  const onCloseRef = useRef(onClose);

  /* ---------- LIFECYCLE ---------- */
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const update = () => {
      setWidth(window.innerWidth);
      setHeight(window.innerHeight);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Reset mute when image changes
  useEffect(() => {
    setIsMuted(true);
  }, []);

  // Reset zoom/pan and close the request dialog whenever the visible image
  // changes. This is also the single place where a lightbox view is counted.
  useEffect(() => {
    const imageId = image?.id;
    if (!imageId) return;
    setShowRequest(false);
    recordImageView(imageId);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setZoomAnimating(false);
    pinchRef.current = null;
    panGestureRef.current = null;
    lastTapRef.current = null;
    return () => {
      if (zoomAnimTimerRef.current !== null) {
        window.clearTimeout(zoomAnimTimerRef.current);
        zoomAnimTimerRef.current = null;
      }
    };
  }, [image?.id]);

  useEffect(() => {
    if (!image || !isVideo(image)) return;
    const video = videoRef.current;
    if (!video) return;
    video.muted = true;
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        // Autoplay might be blocked; ignore.
      });
    }
  }, [image?.id, image]);

  /* ---------- PRELOAD ---------- */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const images: HTMLImageElement[] = [];
    [nextImage, prevImage].forEach((item) => {
      if (!item || isVideo(item)) return;
      const img = new Image();
      img.src = item.originalUrl || item.url;
      images.push(img);
    });
    return () => {
      images.forEach((img) => {
        img.src = ""; // Cancel loading
      });
    };
  }, [nextImage, prevImage]);

  /* ---------- FOCUS TRAP + SCROLL LOCK ---------- */
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = Array.from(
      root.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
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
    onCloseRef.current = onClose;
  });

  /* ---------- CLOSE / ZOOM HELPERS ---------- */
  // History is owned by Gallery, which pushes and clears the entry from the
  // tap handler (mobile browsers only trust user-initiated history entries).
  const closeLightbox = useCallback(() => {
    onCloseRef.current();
  }, []);

  const clampPan = useCallback(
    (x: number, y: number, scale: number) => {
      // Use the slide's own rendered height: landscape images are shorter than
      // the viewport, and clamping to the viewport would let them pan off-screen.
      const slideHeight = slideRef.current?.offsetHeight || height;
      const maxX = (width * (scale - 1)) / 2;
      const maxY = (slideHeight * (scale - 1)) / 2;
      return { x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) };
    },
    [width, height],
  );

  const toggleZoom = useCallback(
    (clientX: number, clientY: number) => {
      if (zoom > 1) {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      } else {
        const nextZoom = DOUBLE_TAP_ZOOM;
        setZoom(nextZoom);
        setPan(
          clampPan(
            (1 - nextZoom) * (clientX - width / 2),
            (1 - nextZoom) * (clientY - height / 2),
            nextZoom,
          ),
        );
      }
      setZoomAnimating(true);
      if (zoomAnimTimerRef.current !== null) {
        window.clearTimeout(zoomAnimTimerRef.current);
      }
      zoomAnimTimerRef.current = window.setTimeout(() => {
        setZoomAnimating(false);
        zoomAnimTimerRef.current = null;
      }, 220);
    },
    [zoom, width, height, clampPan],
  );

  /* ---------- NAVIGATION ---------- */
  const handleNext = useCallback(() => {
    if (isAnimatingRef.current) return;
    if (!nextImage && !canNext) return;
    if (!nextImage && canNext) {
      cbRef.current.onNext();
      return;
    }
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
  }, [nextImage, width, canNext]);

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
  const registerTap = useCallback(
    (clientX: number, clientY: number) => {
      const now = Date.now();
      const last = lastTapRef.current;
      if (
        last &&
        now - last.time < DOUBLE_TAP_MS &&
        Math.hypot(clientX - last.x, clientY - last.y) < DOUBLE_TAP_SLOP
      ) {
        lastTapRef.current = null;
        toggleZoom(clientX, clientY);
        return;
      }
      lastTapRef.current = { time: now, x: clientX, y: clientY };
    },
    [toggleZoom],
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (isAnimatingRef.current) return;

      if (e.touches.length === 2) {
        const a = e.touches[0];
        const b = e.touches[1];
        pinchRef.current = {
          startDist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
          startZoom: zoom,
          startPan: pan,
          startMid: {
            x: (a.clientX + b.clientX) / 2,
            y: (a.clientY + b.clientY) / 2,
          },
        };
        panGestureRef.current = null;
        isDraggingRef.current = false;
        tapMovedRef.current = true;
        setDragOffset(0);
        return;
      }

      if (e.touches.length === 1) {
        const touch = e.touches[0];
        tapMovedRef.current = false;
        if (zoom > 1) {
          panGestureRef.current = {
            startX: touch.clientX,
            startY: touch.clientY,
            startPan: pan,
          };
          isDraggingRef.current = false;
        } else {
          touchStartXRef.current = touch.clientX;
          isDraggingRef.current = true;
        }
      }
    },
    [zoom, pan],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (isAnimatingRef.current) return;

      if (e.touches.length === 2 && pinchRef.current) {
        const a = e.touches[0];
        const b = e.touches[1];
        const gesture = pinchRef.current;
        const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const midX = (a.clientX + b.clientX) / 2;
        const midY = (a.clientY + b.clientY) / 2;
        const nextZoom = clamp(
          gesture.startZoom * (dist / Math.max(gesture.startDist, 1)),
          1,
          MAX_ZOOM,
        );
        const ratio = nextZoom / gesture.startZoom;
        setZoom(nextZoom);
        setPan(
          clampPan(
            midX -
              width / 2 -
              ratio * (gesture.startMid.x - width / 2 - gesture.startPan.x),
            midY -
              height / 2 -
              ratio * (gesture.startMid.y - height / 2 - gesture.startPan.y),
            nextZoom,
          ),
        );
        return;
      }

      if (panGestureRef.current && e.touches.length === 1) {
        const touch = e.touches[0];
        const gesture = panGestureRef.current;
        if (
          Math.abs(touch.clientX - gesture.startX) > 10 ||
          Math.abs(touch.clientY - gesture.startY) > 10
        ) {
          tapMovedRef.current = true;
        }
        setPan(
          clampPan(
            gesture.startPan.x + (touch.clientX - gesture.startX),
            gesture.startPan.y + (touch.clientY - gesture.startY),
            zoom,
          ),
        );
        return;
      }

      if (!isDraggingRef.current) return;
      const dx = e.touches[0].clientX - touchStartXRef.current;

      if (Math.abs(dx) > 10) {
        tapMovedRef.current = true;
      }

      const max = width * 0.5;
      let clamped = dx;
      if (dx > 0 && !prevImage) clamped = Math.min(dx, RUBBERBAND);
      else if (dx < 0 && !nextImage) clamped = Math.max(dx, -RUBBERBAND);
      else clamped = Math.max(-max, Math.min(max, dx));
      setDragOffset(clamped);
    },
    [width, height, zoom, prevImage, nextImage, clampPan],
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (pinchRef.current) {
        if (e.touches.length < 2) {
          pinchRef.current = null;
          if (zoom <= 1.02) {
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }
        }
        return;
      }

      if (panGestureRef.current) {
        if (e.touches.length === 0) {
          panGestureRef.current = null;
          const touch = e.changedTouches[0];
          if (touch && !tapMovedRef.current) {
            registerTap(touch.clientX, touch.clientY);
          }
        }
        return;
      }

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
        const touch = e.changedTouches[0];
        if (touch && !tapMovedRef.current) {
          registerTap(touch.clientX, touch.clientY);
        }
      }
    },
    [width, dragOffset, prevImage, nextImage, zoom, registerTap],
  );

  /* ---------- KEYBOARD ---------- */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      // The request dialog owns the keyboard while it is open.
      if (showRequest) return;
      switch (e.key) {
        case "Escape":
          closeLightbox();
          break;
        case "ArrowLeft":
          handlePrev();
          break;
        case "ArrowRight":
          handleNext();
          break;
      }
    },
    [handlePrev, handleNext, closeLightbox, showRequest],
  );

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
    setLocalDownloading(true);
    let url = `/api/images/${image?.id}/download?quality=${quality}`;
    if (passphrase) {
      url += `&passphrase=${encodeURIComponent(passphrase)}`;
    }

    // Use <a> tag click instead of window.open — avoids iOS popup blocking
    // and is the most reliable cross-platform download trigger.
    const link = document.createElement("a");
    link.href = url;
    link.download = "";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setShowDL(false);
    setTimeout(() => setLocalDownloading(false), 1500);
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
      <div className="absolute top-3 left-3 sm:top-6 sm:left-6 flex items-center gap-2 sm:gap-4 z-20 w-full sm:w-auto pr-20 sm:pr-0">
        <button
          type="button"
          aria-label="Close lightbox"
          onClick={closeLightbox}
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
        {onToggleSelect && (
          <button
            type="button"
            onClick={() => onToggleSelect(image.id)}
            className={`flex-shrink-0 p-2 sm:p-3 rounded-lg sm:rounded-full transition-all ${
              isSelected
                ? "bg-blue-500 hover:bg-blue-600 text-white"
                : "bg-white/10 hover:bg-white/20 text-white"
            }`}
            title={isSelected ? "Deselect" : "Select"}
          >
            <svg
              aria-hidden="true"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              {isSelected ? (
                <path d="M20 6L9 17l-5-5" />
              ) : (
                <circle cx="12" cy="12" r="9" />
              )}
            </svg>
          </button>
        )}
      </div>

      {/* ------ DOWNLOAD ------ */}
      <div className="absolute top-3 right-3 sm:top-6 sm:right-6 z-20 flex flex-col items-end gap-1">
        <button
          type="button"
          aria-label="Download image"
          onClick={handleDownloadClick}
          className="p-2 sm:p-3 bg-white/10 hover:bg-white/20 rounded-lg sm:rounded-xl text-white flex items-center gap-2 transition-colors"
        >
          <DownloadIcon />
          <span className="text-sm font-medium hidden sm:inline">Download</span>
        </button>
        <button
          type="button"
          aria-label="Request RAW file"
          onClick={() => setShowRequest(true)}
          className="p-2 sm:p-3 bg-white/10 hover:bg-white/20 rounded-lg sm:rounded-xl text-white flex items-center gap-2 transition-colors"
        >
          <FiMail size={18} />
          <span className="text-sm font-medium hidden sm:inline">
            Request RAW
          </span>
        </button>
        {(isDownloading || localDownloading) && (
          <span className="text-xs text-blue-300 font-semibold bg-white/10 px-2 py-1 rounded-full">
            Download starting…
          </span>
        )}
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
        type="button"
        aria-label="Previous image"
        onClick={handlePrev}
        disabled={!prevImage}
        className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 p-2 sm:p-4 bg-white/5 hover:bg-white/10 rounded-lg sm:rounded-full text-white transition transform-gpu hover:scale-110 disabled:opacity-30 disabled:hover:scale-100 z-20"
      >
        <ChevronLeftIcon />
      </button>
      <button
        type="button"
        aria-label="Next image"
        onClick={handleNext}
        disabled={!canNext}
        className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 p-2 sm:p-4 bg-white/5 hover:bg-white/10 rounded-lg sm:rounded-full text-white transition transform-gpu hover:scale-110 disabled:opacity-30 disabled:hover:scale-100 z-20"
      >
        <div className="relative">
          <ChevronRightIcon />
          {isLoadingMore && !nextImage && (
            <span className="absolute -right-2 -top-2 w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          )}
        </div>
      </button>

      {/* ------ CAROUSEL ------ */}
      <div
        className={`relative w-full h-full flex items-center justify-center overflow-hidden ${
          zoom > 1 ? "touch-none" : "touch-pan-y"
        }`}
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
              transition:
                isDraggingRef.current || !shouldTransitionRef.current
                  ? "none"
                  : `transform ${ANIM_MS}ms cubic-bezier(0.25,0.1,0.25,1)`,
            }}
          >
            <MediaItem item={prevImage} isMuted={true} isActive={false} />
          </div>
        )}

        {/* Current */}
        <div
          ref={slideRef}
          className="absolute flex items-center justify-center px-4 sm:px-16 will-change-transform"
          style={{
            width,
            transform: `translateX(${activeTranslate}px) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transition: zoomAnimating
              ? "transform 220ms cubic-bezier(0.25,0.1,0.25,1)"
              : isDraggingRef.current ||
                  !shouldTransitionRef.current ||
                  zoom !== 1
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
              type="button"
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
              transition:
                isDraggingRef.current || !shouldTransitionRef.current
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
        Swipe to navigate · Pinch or double-tap to zoom
      </div>

      <RawRequestModal
        isOpen={showRequest}
        fileId={image.id}
        fileName={image.title}
        folderName={image.category}
        passphrase={passphrase}
        onClose={() => setShowRequest(false)}
      />
    </div>
  );
}
