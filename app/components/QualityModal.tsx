"use client";

import { MdClose } from "react-icons/md";

interface QualityModalProps {
  isOpen: boolean;
  onSelect: (quality: string) => void;
  onCancel: () => void;
  highQualitySize?: number;
  mediumQualitySize?: number;
}

export default function QualityModal({
  isOpen,
  onSelect,
  onCancel,
  highQualitySize = 0,
  mediumQualitySize = 0,
}: QualityModalProps) {
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-black/50 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 animate-in scale-in-95 duration-200">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Download Quality
          </h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <MdClose size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Choose the quality for your download. Higher quality means larger file
          sizes.
        </p>

        <div className="space-y-3">
          <button
            onClick={() => onSelect("original")}
            className="w-full p-4 border-2 border-blue-500 bg-blue-50 dark:bg-blue-950/30 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-all text-left group"
          >
            <div className="font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
              Highest Quality
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Original format • {formatBytes(highQualitySize)}
            </div>
          </button>

          <button
            onClick={() => onSelect("webp")}
            className="w-full p-4 border-2 border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-800 rounded-xl hover:bg-gray-100 dark:hover:bg-slate-700 transition-all text-left group"
          >
            <div className="font-bold text-gray-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400">
              Medium Quality
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Optimized WebP • {formatBytes(mediumQualitySize)}
            </div>
          </button>
        </div>

        <button
          onClick={onCancel}
          className="w-full mt-6 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors text-sm font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
