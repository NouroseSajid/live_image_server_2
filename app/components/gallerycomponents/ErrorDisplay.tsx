"use client";

import { MdClose, MdErrorOutline } from "react-icons/md";

interface ErrorDisplayProps {
  error: string;
  onClose: () => void;
}

export default function ErrorDisplay({ error, onClose }: ErrorDisplayProps) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[80] w-full max-w-md px-4 animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="bg-red-500/10 backdrop-blur-xl border border-red-500/20 rounded-xl shadow-lg p-4 flex items-start gap-3">
        <MdErrorOutline className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-red-700 dark:text-red-300">
            {error}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-red-500 hover:text-red-700 dark:hover:text-red-300 transition-colors flex-shrink-0"
          aria-label="Dismiss error"
        >
          <MdClose size={18} />
        </button>
      </div>
    </div>
  );
}
