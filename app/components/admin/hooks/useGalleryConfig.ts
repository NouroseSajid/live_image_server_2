import { type ChangeEvent, useEffect, useState } from "react";

interface UseGalleryConfigOptions {
  setError: (message: string | null) => void;
  setSuccess: (message: string | null) => void;
}

export default function useGalleryConfig({
  setError,
  setSuccess,
}: UseGalleryConfigOptions) {
  const [allThumbnailUrl, setAllThumbnailUrl] = useState<string | null>(null);
  const [allThumbnailUploading, setAllThumbnailUploading] = useState(false);
  const [allThumbnailFile, setAllThumbnailFile] = useState<File | null>(null);
  const [allThumbnailPreview, setAllThumbnailPreview] = useState<string | null>(
    null,
  );
  const [folderMaxAgeMinutes, setFolderMaxAgeMinutes] = useState<
    Record<string, number | null>
  >({});
  const [filterTargetId, setFilterTargetId] = useState<string>("all");
  const [filterMinutes, setFilterMinutes] = useState<number>(5);
  const [filterNoLimit, setFilterNoLimit] = useState<boolean>(true);
  const [filterSaving, setFilterSaving] = useState(false);

  useEffect(() => {
    const fetchGalleryConfig = async () => {
      try {
        const res = await fetch("/api/gallery-config");
        if (res.ok) {
          const data = await res.json();
          setAllThumbnailUrl(data?.allFolderThumbnailUrl ?? null);
          setFolderMaxAgeMinutes(data?.folderMaxAgeMinutes ?? {});
        }
      } catch (err) {
        console.error("Failed to fetch gallery config", err);
      }
    };
    fetchGalleryConfig();
  }, []);

  useEffect(() => {
    const current = folderMaxAgeMinutes?.[filterTargetId] ?? null;
    if (current === null || current === undefined) {
      setFilterNoLimit(true);
      setFilterMinutes(5);
    } else {
      setFilterNoLimit(false);
      setFilterMinutes(current);
    }
  }, [folderMaxAgeMinutes, filterTargetId]);

  const handleAllThumbnailSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAllThumbnailFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setAllThumbnailPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const uploadAllThumbnail = async () => {
    if (!allThumbnailFile) {
      setError("Select an image for the All folder thumbnail first");
      return;
    }
    try {
      setAllThumbnailUploading(true);
      setError(null);
      const formData = new FormData();
      formData.append("file", allThumbnailFile);
      const res = await fetch("/api/gallery-config/thumbnail", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to upload thumbnail");
      }
      const data = await res.json();
      setAllThumbnailUrl(data?.allFolderThumbnailUrl ?? null);
      setAllThumbnailFile(null);
      setAllThumbnailPreview(null);
      setSuccess("All folder thumbnail updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload thumbnail");
    } finally {
      setAllThumbnailUploading(false);
    }
  };

  const saveFolderAgeFilter = async () => {
    try {
      setFilterSaving(true);
      setError(null);
      const nextMap = {
        ...folderMaxAgeMinutes,
        [filterTargetId]: filterNoLimit ? null : Math.max(1, filterMinutes),
      };

      const res = await fetch("/api/gallery-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allFolderThumbnailUrl: allThumbnailUrl,
          folderMaxAgeMinutes: nextMap,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to save time filter");
      }

      setFolderMaxAgeMinutes(nextMap);
      setSuccess("Gallery time filter updated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save time filter");
    } finally {
      setFilterSaving(false);
    }
  };

  return {
    allThumbnailUrl,
    allThumbnailUploading,
    allThumbnailFile,
    allThumbnailPreview,
    filterTargetId,
    filterMinutes,
    filterNoLimit,
    filterSaving,
    setFilterTargetId,
    setFilterMinutes,
    setFilterNoLimit,
    handleAllThumbnailSelect,
    uploadAllThumbnail,
    saveFolderAgeFilter,
  };
}
