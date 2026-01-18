"use client";

import { useState, useEffect } from "react";
import { MdClose, MdDownload, MdMoreHoriz } from "react-icons/md";
import { BiChevronLeft, BiChevronRight } from "react-icons/bi";

interface Image {
  id: string;
  width: number;
  height: number;
  url: string;
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

  return (
    <div className="fixed inset-0 z-[1000] bg-black/95 backdrop-blur-2xl flex items-center justify-center animate-in fade-in duration-300">
      <div className="absolute top-6 left-6 flex items-center gap-4 z-10">
        <button
          onClick={onClose}
          className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
        >
          <MdClose size={24} />
        </button>
        <div>
          <h2 className="text-white font-bold">{img.title}</h2>
          <p className="text-white/40 text-xs">{img.meta}</p>
        </div>
      </div>

      <div className="absolute top-6 right-6 flex items-center gap-2 z-10">
        <div className="relative">
          <button
            onClick={handleDownloadClick}
            className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white flex items-center gap-2 transition-colors"
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
        <button className="p-3 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-colors">
          <MdMoreHoriz size={20} />
        </button>
      </div>

      {/* Navigation */}
      <button
        onClick={onPrev}
        className="absolute left-6 top-1/2 -translate-y-1/2 p-4 bg-white/5 hover:bg-white/10 rounded-full text-white transition-all hover:scale-110"
      >
        <BiChevronLeft size={32} />
      </button>
      <button
        onClick={onNext}
        className="absolute right-6 top-1/2 -translate-y-1/2 p-4 bg-white/5 hover:bg-white/10 rounded-full text-white transition-all hover:scale-110"
      >
        <BiChevronRight size={32} />
      </button>

      <div className="relative max-w-[90vw] max-h-[85vh] group">
        <img
          src={img.url}
          className="max-w-full max-h-[calc(100vh-120px)] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-500"
          alt="Preview"
        />
      </div>
    </div>
  );
}
