"use client";

import { useRef, useState } from "react";
import { MdCheckCircle } from "react-icons/md";

interface Image {
  id: string;
  width: number;
  height: number;
  url: string;
  category: string;
  title: string;
  meta: string;
}

interface ImageCardProps {
  img: Image;
  width: number;
  height: number;
  selected: boolean;
  hasSelection: boolean;
  onToggle: () => void;
  onOpen: (img: Image) => void;
}

export default function ImageCard({
  img,
  width,
  height,
  selected,
  hasSelection,
  onToggle,
  onOpen,
}: ImageCardProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const longPressRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };

    longPressRef.current = setTimeout(() => {
      // Long press detected - toggle selection
      onToggle();
    }, 500); // 500ms for long press
  };

  const handleTouchEnd = () => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    const dx = Math.abs(e.touches[0].clientX - touchStartRef.current.x);
    const dy = Math.abs(e.touches[0].clientY - touchStartRef.current.y);

    // If user moved too much, cancel long press
    if (dx > 10 || dy > 10) {
      if (longPressRef.current) {
        clearTimeout(longPressRef.current);
        longPressRef.current = null;
      }
    }
  };

  return (
    <div
      className={`relative rounded-2xl overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] group select-none shadow-md cursor-pointer ${
        selected
          ? "ring-4 ring-blue-500 scale-[0.96]"
          : "hover:scale-[1.03] hover:shadow-2xl"
      }`}
      style={{ width, height, backgroundColor: "#18181b" }}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey) {
          onToggle();
        } else {
          onOpen(img);
        }
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`absolute inset-0 bg-zinc-800 transition-opacity duration-700 ${
          isLoaded ? "opacity-0" : "opacity-100"
        } flex items-center justify-center`}
      >
        <div className="w-8 h-8 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
      </div>

      <img
        src={img.url}
        alt={img.category}
        onLoad={() => setIsLoaded(true)}
        className={`w-full h-full object-cover transition-all duration-1000 group-hover:scale-110 ${
          isLoaded ? "opacity-100" : "opacity-0"
        }`}
        loading="lazy"
      />

      <div
        className={`absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 transition-opacity duration-300 ${
          selected ? "opacity-100" : "opacity-0 md:group-hover:opacity-100"
        }`}
      />

      {(hasSelection || selected || isHovered) && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className={`absolute top-4 left-4 z-20 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 backdrop-blur-md border ${
            selected
              ? "bg-blue-500 border-blue-400 scale-110"
              : "bg-black/40 border-white/30 hover:bg-black/50"
          }`}
        >
          <MdCheckCircle
            size={16}
            className={`text-white transition-transform ${
              selected ? "scale-100" : "scale-0"
            }`}
          />
        </button>
      )}

      <div className="absolute bottom-4 left-4 right-4 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
        <p className="text-white text-sm font-bold truncate">{img.title}</p>
        <p className="text-white/60 text-[10px] uppercase tracking-wider font-medium">
          {img.meta}
        </p>
      </div>
    </div>
  );
}
