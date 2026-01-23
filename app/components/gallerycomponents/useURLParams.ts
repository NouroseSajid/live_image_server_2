import { useEffect, useState } from "react";

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

export interface UseURLParamsResult {
  folders: Folder[];
  activeFolder: string;
  folderPassphrases: Record<string, string>;
  setActiveFolder: (id: string) => void;
  setFolderPassphrases: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  setError: (error: string | null) => void;
}

export function useURLParams(
  folders: Folder[],
  initialFolderId?: string,
): UseURLParamsResult {
  const [activeFolder, setActiveFolder] = useState<string>(
    initialFolderId || "all",
  );
  const [folderPassphrases, setFolderPassphrases] = useState<
    Record<string, string>
  >({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const folderParam = params.get("f");
    const passphraseParam = params.get("p");
    const tokenParam = params.get("t") || params.get("token");

    // Restore from sessionStorage (set by /f/[slug] page)
    try {
      const sessionStored = sessionStorage.getItem("folderPassphrases");
      if (sessionStored) {
        const sessionPassphrases = JSON.parse(sessionStored);
        setFolderPassphrases((prev) => ({ ...prev, ...sessionPassphrases }));
        sessionStorage.removeItem("folderPassphrases");
      }
    } catch (err) {
      console.error("[Gallery] Failed to restore session passphrases", err);
    }

    const applyFolder = (id: string) => {
      setActiveFolder(id);
      window.history.replaceState({}, "", `?f=${id}`);
    };

    // Token flow: validate and set cookie, then activate folder
    const maybeValidateToken = async () => {
      if (!tokenParam) return;
      try {
        const res = await fetch(`/api/access-links/${tokenParam}`);
        if (res.ok) {
          const data = await res.json();
          applyFolder(data.folderId);
        } else {
          setError("Access link is invalid or expired.");
        }
      } catch (err) {
        console.error("[Gallery] Failed to validate token", err);
        setError("Access link validation failed.");
      }
    };

    if (tokenParam) {
      maybeValidateToken();
      return;
    }

    // If folder param in URL, auto-select it
    if (folderParam) {
      applyFolder(folderParam);

      // If passphrase in URL, add it to state and clean the URL
      if (passphraseParam) {
        setFolderPassphrases((prev) => ({
          ...prev,
          [folderParam]: decodeURIComponent(passphraseParam),
        }));
        window.history.replaceState({}, "", `?f=${folderParam}`);
      }
    }
  }, []);

  return {
    folders,
    activeFolder,
    folderPassphrases,
    setActiveFolder,
    setFolderPassphrases,
    setError,
  };
}
