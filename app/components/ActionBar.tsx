"use client";

import { MdDownload, MdShare, MdOpenInNew, MdDelete, MdClose } from "react-icons/md";
import { useState, useEffect } from "react";

interface ActionBarProps {
  selectedCount: number;
  selectedIds: Set<string>;
  highQualitySize?: number;
  mediumQualitySize?: number;
  onClear: () => void;
  onDownloadAll?: () => void;
  onShare?: () => void;
}

export default function ActionBar({ 
  selectedCount, 
  selectedIds,
  highQualitySize = 0,
  mediumQualitySize = 0,
  onClear,
  onDownloadAll,
  onShare
}: ActionBarProps) {
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const handleDownloadAll = () => {
    if (onDownloadAll) {
      onDownloadAll();
    }
  };

  const handleShare = () => {
    if (onShare) {
      onShare();
    }
  };

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[60] animate-in fade-in slide-in-from-bottom-10 duration-500 ease-out">
      <div className="bg-zinc-900/90 border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.5)] rounded-[24px] px-8 py-5 flex items-center gap-8 backdrop-blur-2xl">
        <div className="flex items-center gap-4 pr-8 border-r border-white/10">
          <div className="bg-blue-600 text-white text-xs font-black w-8 h-8 flex items-center justify-center rounded-xl shadow-lg shadow-blue-500/40">
            {selectedCount}
          </div>
          <div>
            <span className="text-sm font-bold block leading-none">Selected</span>
            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-tighter">
              HQ: {formatBytes(highQualitySize)} | MQ: {formatBytes(mediumQualitySize)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {[
            { icon: MdDownload, label: "Download All", action: handleDownloadAll },
            { icon: MdShare, label: "Share", action: handleShare },
          ].map((action, i) => (
            <button
              key={i}
              onClick={action.action}
              className="flex flex-col items-center justify-center w-16 h-16 rounded-2xl transition-all hover:bg-white/5 active:scale-90 group text-zinc-400"
            >
              <action.icon
                size={20}
                className="group-hover:scale-110 transition-transform mb-1"
              />
              <span className="text-[9px] font-black uppercase tracking-widest opacity-40 group-hover:opacity-100">
                {action.label}
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={onClear}
          className="ml-4 p-3 hover:bg-white/5 rounded-full text-zinc-600 hover:text-white transition-colors"
        >
          <MdClose size={20} />
        </button>
      </div>
    </div>
  );
}
