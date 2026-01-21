"use client";

import { AlertCircle, Check, UploadCloud, X } from "lucide-react";
import Image from "next/image";
import { useUploads } from "@/app/lib/useUploads";

const UploadToast = () => {
  const uploads = useUploads((state) => state.uploads);
  const remove = useUploads((state) => state.remove);

  const getThumbnail = (upload) => {
    if (upload.file.type.startsWith("image/")) {
      return (
        <Image
          src={URL.createObjectURL(upload.file)}
          alt={upload.file.name}
          width={40}
          height={40}
          className="aspect-square rounded-md object-cover"
        />
      );
    }
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-200">
        <UploadCloud className="h-6 w-6 text-slate-500" />
      </div>
    );
  };

  const uploadingCount = uploads.filter((u) => u.status === "uploading").length;
  const successCount = uploads.filter((u) => u.status === "success").length;
  const errorCount = uploads.filter((u) => u.status === "error").length;
  const totalProgress = Math.round(
    uploads.reduce((sum, u) => sum + u.progress, 0) / uploads.length || 0,
  );

  if (uploads.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-full max-w-md rounded-lg bg-white shadow-2xl dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
      <div className="border-b border-slate-200 p-4 dark:border-slate-700">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold">
            {uploads.length > 1
              ? `Uploading ${uploads.length} images`
              : "Uploading image"}
          </h3>
          <span className="flex gap-2 text-sm">
            {uploadingCount > 0 && (
              <span className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                {uploadingCount}
              </span>
            )}
            {successCount > 0 && (
              <span className="text-green-600">✓ {successCount}</span>
            )}
            {errorCount > 0 && (
              <span className="text-red-600">✗ {errorCount}</span>
            )}
          </span>
        </div>
        {uploads.length > 1 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Overall Progress</span>
              <span>{totalProgress}%</span>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                style={{ width: `${totalProgress}%` }}
                className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all"
              />
            </div>
          </div>
        )}
      </div>
      <ul className="max-h-96 overflow-y-auto p-4 space-y-3">
        {uploads.map((upload) => (
          <li
            key={upload.id}
            className={`flex items-center gap-3 rounded-lg p-3 transition-colors ${
              upload.status === "error"
                ? "bg-red-50 dark:bg-red-950"
                : upload.status === "success"
                  ? "bg-green-50 dark:bg-green-950"
                  : "bg-slate-50 dark:bg-slate-700"
            }`}
          >
            <div className="relative flex-shrink-0">
              {getThumbnail(upload)}
              {upload.status === "uploading" && (
                <div className="absolute inset-0 rounded-md border-2 border-blue-500 animate-pulse" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate font-medium text-sm">{upload.file.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {(upload.file.size / 1024 / 1024).toFixed(2)} MB
              </p>
              {upload.status === "error" && upload.error && (
                <p className="text-xs text-red-500 dark:text-red-400 mt-1 break-words">
                  Error: {upload.error}
                </p>
              )}
              {upload.status !== "error" && ( // Only show progress bar if not in error state
                <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-600 mt-1">
                  <div
                    style={{ width: `${upload.progress}%` }}
                    className={`absolute left-0 top-0 h-full transition-all ${
                      upload.status === "error"
                        ? "bg-red-500"
                        : upload.status === "success"
                          ? "bg-green-500"
                          : "bg-gradient-to-r from-blue-400 to-blue-600"
                    }`}
                  />
                </div>
              )}
            </div>
            <div className="flex flex-col items-center gap-2 flex-shrink-0">
              <div className="text-center">
                {upload.status === "uploading" && (
                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                    {Math.round(upload.progress)}%
                  </p>
                )}
                {upload.status === "success" && (
                  <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
                )}
                {upload.status === "error" && (
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                )}
                {upload.status === "pending" && (
                  <div className="h-5 w-5 rounded-full border-2 border-slate-300 border-t-blue-500 animate-spin" />
                )}
              </div>
              <button
                onClick={() => remove(upload.id)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default UploadToast;
