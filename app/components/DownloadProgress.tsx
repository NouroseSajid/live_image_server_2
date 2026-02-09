"use client";

import { useEffect, useState } from "react";
import { MdClose, MdDownload } from "react-icons/md";

interface DownloadProgressProps {
  downloadId: string;
  totalFiles: number;
  onClose: () => void;
}

export default function DownloadProgress({
  downloadId,
  totalFiles,
  onClose,
}: DownloadProgressProps) {
  const [progress, setProgress] = useState(0);
  const [currentBytes, setCurrentBytes] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [status, setStatus] = useState<"preparing" | "downloading" | "complete">("preparing");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const wsUrl = `ws://${process.env.NEXT_PUBLIC_WS_SERVER_HOST || "localhost"}:${process.env.NEXT_PUBLIC_WS_SERVER_PORT || "8080"}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("[DownloadProgress] WebSocket connected");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "download-progress" && msg.payload.downloadId === downloadId) {
          const { current, total, percent } = msg.payload;
          setCurrentBytes(current);
          setTotalBytes(total);
          setProgress(percent);
          setStatus("downloading");
        }
      } catch (err) {
        console.error("[DownloadProgress] Error parsing message:", err);
      }
    };

    ws.onerror = (error) => {
      console.error("[DownloadProgress] WebSocket error:", error);
    };

    ws.onclose = () => {
      console.log("[DownloadProgress] WebSocket closed");
    };

    return () => {
      ws.close();
    };
  }, [downloadId]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] w-full max-w-md px-4">
      <div className="bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500/20 p-2 rounded-lg">
              <MdDownload className="text-blue-400" size={20} />
            </div>
            <div>
              <h3 className="text-white font-semibold">Downloading ZIP</h3>
              <p className="text-zinc-400 text-sm">{totalFiles} images</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-white transition-colors"
            aria-label="Close progress"
          >
            <MdClose size={20} />
          </button>
        </div>

        {status === "preparing" && (
          <div className="space-y-2">
            <div className="text-zinc-300 text-sm">Preparing files...</div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full animate-pulse w-1/3" />
            </div>
          </div>
        )}

        {status === "downloading" && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-zinc-300">
                {formatBytes(currentBytes)} / {formatBytes(totalBytes)}
              </span>
              <span className="text-blue-400 font-semibold">{progress}%</span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {status === "complete" && (
          <div className="flex items-center gap-2 text-green-400">
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              role="img"
              aria-label="Download complete"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="font-medium">Download complete!</span>
          </div>
        )}
      </div>
    </div>
  );
}
