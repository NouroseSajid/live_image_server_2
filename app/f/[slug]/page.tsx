"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Gallery from "../../components/Gallery";

export default function FolderPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const slug = params.slug as string;

  const passphrase = searchParams.get("p");

  const [folderId, setFolderId] = useState<string | null>(null);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Resolve slug to folder ID on mount
  useEffect(() => {
    const resolveFolderSlug = async () => {
      try {
        const res = await fetch("/api/folders");
        if (!res.ok) throw new Error("Failed to fetch folders");
        const folders = await res.json();

        const folder = folders.find(
          (f: { uniqueUrl: string; id: string; name: string }) =>
            f.uniqueUrl === slug,
        );

        if (!folder) {
          setError("Folder not found");
          setIsLoading(false);
          return;
        }

        setFolderId(folder.id);
        setFolderName(folder.name);

        // If passphrase in URL, set it in sessionStorage for Gallery to pick up
        if (passphrase) {
          const stored = sessionStorage.getItem("folderPassphrases");
          const passphrases = stored ? JSON.parse(stored) : {};
          passphrases[folder.id] = decodeURIComponent(passphrase);
          sessionStorage.setItem("folderPassphrases", JSON.stringify(passphrases));
        }

        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load folder");
        setIsLoading(false);
      }
    };

    resolveFolderSlug();
  }, [slug, passphrase]);

  if (isLoading) {
    return (
      <main id="main-content" className="flex-1 mt-16 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </main>
    );
  }

  if (error) {
    return (
      <main id="main-content" className="flex-1 mt-16 p-6">
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
          {error}
        </div>
      </main>
    );
  }

  if (!folderId) return null;

  // Gallery will auto-select this folder and use stored passphrase if present
  return (
    <div>
      <Gallery initialFolderId={folderId} />
    </div>
  );
}
