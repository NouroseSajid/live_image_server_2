import { useEffect, useState } from "react";

interface FetchedImage {
  id: string;
  fileName: string;
  folderId: string;
  fileType: "image" | "video";
  variants: {
    name: string;
    path: string;
    size?: number;
  }[];
  width: number;
  height: number;
  url: string;
  category: string;
  title: string;
  meta: string;
}

interface Folder {
  id: string;
  name: string;
  isPrivate?: boolean;
  passphrase?: string | null;
  inGridView?: boolean;
  _count?: {
    files: number;
  };
}

interface UseImageFetchOptions {
  activeFolder: string;
  offset: number;
  batchSize: number;
  folders: Folder[];
  folderPassphrases: Record<string, string>;
  passphraseModal: { folderId: string; name: string } | null;
  onPassphraseRequired: (folderId: string, folderName: string) => void;
  onError: (error: string) => void;
}

export function useImageFetch({
  activeFolder,
  offset,
  batchSize,
  folders,
  folderPassphrases,
  passphraseModal,
  onPassphraseRequired,
  onError,
}: UseImageFetchOptions) {
  const [images, setImages] = useState<FetchedImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    const fetchImages = async () => {
      // Don't fetch if passphrase modal is open - prevents infinite loop
      if (passphraseModal) {
        return;
      }

      setIsLoading(true);
      try {
        const currentFolder = folders.find((f) => f.id === activeFolder);
        const pass =
          activeFolder !== "all" && currentFolder?.isPrivate
            ? folderPassphrases[activeFolder]
            : undefined;
        const passQuery = pass ? `&passphrase=${encodeURIComponent(pass)}` : "";
        const folderQuery =
          activeFolder !== "all" ? `&folderId=${activeFolder}` : "";
        const res = await fetch(
          `/api/images/repo?limit=${batchSize}&offset=${offset}${folderQuery}${passQuery}`,
        );
        
        if (res.ok) {
          const data: FetchedImage[] = await res.json();
          if (offset === 0) {
            setImages(data);
          } else {
            setImages((prev) => [...prev, ...data]);
          }
          setHasMore(data.length === batchSize);
        } else if (res.status === 401 || res.status === 403) {
          onError("Passphrase required or invalid for this folder.");
          const folder = folders.find((f) => f.id === activeFolder);
          if (folder && !passphraseModal) {
            onPassphraseRequired(folder.id, folder.name);
          }
        } else {
          onError("Failed to load images. Please try again.");
        }
      } catch (_err) {
        onError("Network error loading images. Please check your connection.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchImages();
  }, [
    offset,
    activeFolder,
    folders,
    folderPassphrases,
    passphraseModal,
    batchSize,
    onPassphraseRequired,
    onError,
  ]);

  // Reset when changing folder
  useEffect(() => {
    setImages([]);
    setHasMore(true);
  }, [activeFolder]);

  return { images, setImages, isLoading, hasMore };
}
