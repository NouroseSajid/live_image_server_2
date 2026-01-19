"use client";

import { useState, useEffect } from "react";
import { MdClose, MdDownload, MdMoreHoriz } from "react-icons/md";
import { BiChevronLeft, BiChevronRight } from "react-icons/bi";

interface Image {
  id: string;
  width: number;
  height: number;
  url: string;
  originalUrl?: string;
  category: string;
  title: string;
  meta: string;
}

interface LightboxProps {
  img: Image | null;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}

function DownloadModal({ onDownload, onCancel, onSavePreference }) {
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

export default function Lightbox({ img, onClose, onNext, onPrev }: LightboxProps) {
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [savePreference, setSavePreference] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  if (!img) return null;

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
    window.open(`/api/images/${img.id}/download?quality=${quality}`, "_blank");
    setShowDownloadModal(false);
  };

  // Handle swipe gestures for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setTouchEnd(e.changedTouches[0].clientX);
    handleSwipe();
  };

  const handleSwipe = () => {
    const minSwipeDistance = 50;
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      onNext();
    } else if (isRightSwipe) {
      onPrev();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-2xl flex items-center justify-center animate-in fade-in duration-300"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
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
          <h2 className="text-white font-bold text-sm sm:text-base truncate">{img.title}</h2>
          <p className="text-white/40 text-xs">{img.meta}</p>
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
            <span className="text-sm font-medium hidden sm:inline">Download</span>
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

      {/* Image Container */}
      <div className="relative max-w-[95vw] sm:max-w-[90vw] max-h-[75vh] sm:max-h-[85vh] group px-4 sm:px-0 mt-12 sm:mt-0">
        <img
          src={img.originalUrl || img.url}
          className="max-w-full max-h-[calc(100vh-100px)] sm:max-h-[calc(100vh-120px)] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-500"
          alt="Preview"
        />
      </div>

      {/* Swipe hint on mobile */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/40 text-xs sm:hidden">
        Swipe to navigate
      </div>
    </div>
  );
}
