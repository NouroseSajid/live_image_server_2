"use client";

import { MdClose, MdDownload } from "react-icons/md";

interface ActionBarProps {
  selectedCount: number;
  highQualitySize?: number | bigint;
  mediumQualitySize?: number | bigint;
  onClear: () => void;
  onDownloadAll?: () => void;
}

export default function ActionBar({
  selectedCount,
  highQualitySize = 0,
  mediumQualitySize = 0,
  onClear,
  onDownloadAll,
}: ActionBarProps) {
  const formatBytes = (bytes: number | bigint): string => {
    // Convert to number if BigInt
    const bytesNum = typeof bytes === "bigint" ? Number(bytes) : bytes;

    if (bytesNum === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytesNum) / Math.log(k));
    return `${Math.round((bytesNum / k ** i) * 100) / 100} ${sizes[i]}`;
  };

  const handleDownloadAll = () => {
    if (onDownloadAll) {
      onDownloadAll();
    }
  };

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] animate-in fade-in slide-in-from-bottom-10 duration-500 ease-out w-full px-3 sm:w-auto">
      <div className="bg-zinc-900/90 border border-white/10 shadow-[0_30px_60px_rgba(0,0,0,0.5)] rounded-xl sm:rounded-[24px] p-2 sm:px-8 sm:py-5 flex flex-row flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-8 backdrop-blur-2xl">
        <div className="flex items-center gap-2 sm:gap-3 sm:pr-8 sm:border-r sm:border-white/10">
          <div className="bg-blue-600 text-white text-xs font-black w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-lg sm:rounded-xl shadow-lg shadow-blue-500/40 flex-shrink-0">
            {selectedCount}
          </div>
          <div className="min-w-0">
            <span className="text-xs sm:text-sm font-bold block leading-none">
              Selected
            </span>
            <span className="text-[9px] sm:text-[10px] text-zinc-500 uppercase font-bold tracking-tighter break-words">
              HQ: {formatBytes(highQualitySize)} | MQ:{" "}
              {formatBytes(mediumQualitySize)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-center sm:justify-start">
          <button
            onClick={handleDownloadAll}
            className="flex flex-col items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-lg sm:rounded-2xl transition-all hover:bg-white/5 active:scale-90 group text-zinc-400 flex-shrink-0"
            title="Download Selected"
          >
            <MdDownload
              size={18}
              className="sm:w-5 sm:h-5 group-hover:scale-110 transition-transform mb-1"
            />
            <span className="text-[7px] sm:text-[9px] font-black uppercase tracking-widest opacity-40 group-hover:opacity-100">
              Download Selected
            </span>
          </button>
        </div>

        <button
          type="button"
          onClick={onClear}
          className="ml-auto sm:ml-4 p-2 sm:p-3 hover:bg-white/5 rounded-full text-zinc-600 hover:text-white transition-colors flex-shrink-0"
          title="Clear selection"
        >
          <MdClose size={20} />
        </button>
      </div>
    </div>
  );
}
