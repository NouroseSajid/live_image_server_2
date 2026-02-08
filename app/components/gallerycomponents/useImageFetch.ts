import { useEffect, useRef, useState } from "react";

interface FetchedImage {
  id: string;
  fileName: string;
  folderId: string;
  fileType: "image" | "video";
  mimeType?: string;
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
  createdAt?: string;
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
  const lastLoadedFolderRef = useRef<string | null>(null);
  
  // Use refs to access folders and passphrases without triggering re-fetches
  const foldersRef = useRef(folders);
  const passphraseRef = useRef(folderPassphrases);
  const onErrorRef = useRef(onError);
  const onPassphraseRequiredRef = useRef(onPassphraseRequired);

  // Keep refs in sync
  useEffect(() => {
    foldersRef.current = folders;
    passphraseRef.current = folderPassphrases;
    onErrorRef.current = onError;
    onPassphraseRequiredRef.current = onPassphraseRequired;
  }, [folders, folderPassphrases, onError, onPassphraseRequired]);

  useEffect(() => {
    // Don't fetch if offset is 0 and images already loaded for the same folder
    if (offset === 0 && images.length > 0 && lastLoadedFolderRef.current === activeFolder) {
      return;
    }

    // Don't fetch if no more results to load
    if (!hasMore && offset > 0) {
      return;
    }

    const fetchImages = async () => {
      // Don't fetch if passphrase modal is open - prevents infinite loop
      if (passphraseModal) {
        return;
      }

      setIsLoading(true);
      try {
        const currentFolder = foldersRef.current.find((f) => f.id === activeFolder);
        const pass =
          activeFolder !== "all" && currentFolder?.isPrivate
            ? passphraseRef.current[activeFolder]
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
            lastLoadedFolderRef.current = activeFolder;
          } else {
            setImages((prev) => [...prev, ...data]);
          }
          // Only set hasMore to true if we got a full batch, false if we got less
          setHasMore(data.length === batchSize);
        } else if (res.status === 401 || res.status === 403) {
          onErrorRef.current("Passphrase required or invalid for this folder.");
          const folder = foldersRef.current.find((f) => f.id === activeFolder);
          if (folder && !passphraseModal) {
            onPassphraseRequiredRef.current(folder.id, folder.name);
          }
        } else {
          onErrorRef.current("Failed to load images. Please try again.");
        }
      } catch (_err) {
        onErrorRef.current("Network error loading images. Please check your connection.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchImages();
  }, [offset, activeFolder, passphraseModal, batchSize]);

  // Reset when changing folder
  useEffect(() => {
    setImages([]);
    setHasMore(true);
  }, [activeFolder]);

  return { images, setImages, isLoading, hasMore };
}
