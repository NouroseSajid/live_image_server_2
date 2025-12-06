
"use client";

import { useState } from "react";

interface ThumbnailUploaderProps {
  folder: {
    id: string;
    folderThumb: string | null;
  };
  onThumbnailUpdate: (newThumbnailUrl: string) => void;
}

export default function ThumbnailUploader({ folder, onThumbnailUpdate }: ThumbnailUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      handleUpload(file);
    }
  };

  const handleUpload = async (file: File) => {
    if (!folder) return;

    setUploading(true);
    setError(null);

    try {
      const response = await fetch(`/api/folders/${folder.id}/thumbnail`, {
        method: "POST",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Thumbnail upload failed");
      }

      const { thumbnailUrl } = await response.json();
      onThumbnailUpdate(thumbnailUrl);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setUploading(false);
      setSelectedFile(null);
    }
  };

  return (
    <div className="md:col-span-2">
      <label className="block text-sm font-medium mb-1">
        Folder Thumbnail
      </label>
      <div className="flex items-center gap-4">
        {folder.folderThumb && (
          <img
            src={folder.folderThumb}
            alt="Thumbnail preview"
            className="h-16 w-16 rounded-md object-cover"
          />
        )}
        <div className="flex-grow">
          <input
            id="thumbnail-upload"
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="block w-full text-sm text-slate-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-violet-50 file:text-violet-700
              hover:file:bg-violet-100"
            disabled={uploading}
          />
          {uploading && <p className="text-sm text-gray-500 mt-1">Uploading...</p>}
          {error && <p className="text-sm text-red-500 mt-1">{error}</p>}
        </div>
      </div>
    </div>
  );
}
