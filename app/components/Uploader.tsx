"use client";

import axios from "axios";
import { useCallback, useEffect, useRef } from "react";
import { type Upload, useUploads } from "@/app/lib/useUploads";

const Uploader = () => {
  const uploads = useUploads((state) => state.uploads);
  const update = useUploads((state) => state.update);
  const uploadingIdsRef = useRef<Set<string>>(new Set());
  const maxConcurrent = 3;

  const handleUpload = useCallback(
    async (upload: Upload) => {
      update(upload.id, { status: "uploading" });

      try {
        const res = await axios.post("/api/images/upload", upload.file, {
          headers: {
            "Content-Type": upload.file.type || "application/octet-stream",
            "X-File-Name": encodeURIComponent(upload.file.name),
            "X-Folder-Id": upload.folderId,
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const progress =
                (progressEvent.loaded / progressEvent.total) * 100;
              update(upload.id, { progress: Math.min(progress, 99) });
            }
          },
        });

        update(upload.id, {
          status: "success",
          result: res.data,
          progress: 100,
        });
      } catch (err: unknown) {
        const error = axios.isAxiosError(err)
          ? typeof err.response?.data?.error === "string"
            ? err.response.data.error
            : err.message
          : err instanceof Error
            ? err.message
            : "Upload failed";
        update(upload.id, { status: "error", error });
      } finally {
        uploadingIdsRef.current.delete(upload.id);
      }
    },
    [update],
  );

  useEffect(() => {
    const pendingUploads = uploads.filter(
      (upload) => upload.status === "pending",
    );

    if (
      pendingUploads.length > 0 &&
      uploadingIdsRef.current.size < maxConcurrent
    ) {
      const available = maxConcurrent - uploadingIdsRef.current.size;
      const toUpload = pendingUploads.slice(0, available);

      toUpload.forEach((upload) => {
        uploadingIdsRef.current.add(upload.id);
        handleUpload(upload);
      });
    }
  }, [uploads, handleUpload]);

  return null;
};

export default Uploader;
