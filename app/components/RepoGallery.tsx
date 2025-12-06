"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import type { Folder, Image as GalleryImage } from "../types/gallery";
import PhotoGrid from "./gallery/PhotoGrid";

export function RepoGallery() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [repoImages, setRepoImages] = useState<GalleryImage[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [showPassphraseModal, setShowPassphraseModal] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [passphraseError, setPassphraseError] = useState("");

  useEffect(() => {
    const initializeFolders = async () => {
      if (process.env.NEXT_PUBLIC_WHAT_AM_I === "1") {
        console.log("NEXT_PUBLIC_WHAT_AM_I is '1'. Fetching LIVE folder...");
        const res = await fetch("/api/folders?nameStartsWith=LIVE");
        if (res.ok) {
          const data: Folder[] = await res.json();
          if (data.length > 0) {
            console.log("LIVE folder fetched:", data[0]);
            setFolders([data[0]]);
            setSelectedFolder(data[0]); // Automatically select the LIVE folder
            fetchRepoImages(data[0]); // Fetch images for the LIVE folder
          } else {
            console.error("No 'LIVE' folder found in the database.");
            setFolders([]);
          }
        } else {
          console.error("Failed to fetch 'LIVE' folder");
          setFolders([]);
        }
      } else {
        fetchFolders();
        fetchRepoImages(); // Fetch all images if not in LIVE mode
      }
    };

    initializeFolders();
  }, []);

  const fetchFolders = async () => {
    const res = await fetch("/api/folders");
    if (res.ok) {
      const data: Folder[] = await res.json();
      setFolders(data);
    } else {
      console.error("Failed to fetch folders");
    }
  };

  const fetchRepoImages = async (folder: Folder | null = null) => {
    const url = folder
      ? `/api/images/repo?uniqueUrl=${folder.uniqueUrl}`
      : "/api/images/repo";
    console.log("Fetching repository images from URL:", url);
    const res = await fetch(url);
    if (res.ok) {
      const data: GalleryImage[] = await res.json();
      console.log("Fetched repository images:", data);
      setRepoImages(data);
    } else {
      console.error("Failed to fetch repository images from URL:", url);
    }
  };

  const handleFolderClick = (folder: Folder) => {
    if (folder.isPrivate) {
      setSelectedFolder(folder);
      setPassphrase("");
      setPassphraseError("");
      setShowPassphraseModal(true);
    } else {
      setSelectedFolder(folder);
      fetchRepoImages(folder);
    }
  };

  const handlePassphraseSubmit = async () => {
    if (!selectedFolder) return;
    setPassphraseError("");

    try {
      const res = await fetch("/api/auth/validate-passphrase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          folderId: selectedFolder.id,
          passphrase: passphrase,
        }),
      });

      if (res.ok) {
        setShowPassphraseModal(false);
        fetchRepoImages(selectedFolder);
      } else {
        const errorData = await res.json();
        setPassphraseError(errorData.error || "Incorrect passphrase.");
      }
    } catch (error) {
      console.error("Passphrase validation error:", error);
      setPassphraseError("An unexpected error occurred.");
    }
  };

  return (
    <div className="relative">
      {/* Blurred background placeholder */}
      <div
        className="absolute inset-0 bg-cover bg-center blur-lg opacity-50"
        style={{ backgroundImage: "url('/placeholder-repo-bg.jpg')" }}
      />

      <div className="relative z-10 flex flex-col items-center h-full text-white p-4">
        <h2 className="text-4xl font-bold mb-8 drop-shadow-lg">
          {process.env.NEXT_PUBLIC_WHAT_AM_I === "1" ? "LIVE 5" : "Repository"}
        </h2>
        {process.env.NEXT_PUBLIC_WHAT_AM_I === "1" && (
          <a
            href="https://repo.nourose.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 transition mb-4 block"
          >
            See other folders
          </a>
        )}

        <div className="w-[95%] space-y-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/30 rounded-xl p-6 shadow-lg"
          >
            <h3 className="text-2xl font-semibold mb-4 drop-shadow">Folders</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {folders.map((folder) => (
                <motion.div
                  key={folder.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative group cursor-pointer overflow-hidden rounded-xl shadow-lg"
                  onClick={() => handleFolderClick(folder)}
                >
                  <img
                    src={folder.folderThumb || "/placeholder-folder.jpg"}
                    alt={folder.name}
                    className="w-full h-32 object-contain bg-gray-900 border border-gray-700 transition-transform duration-300 group-hover:scale-110"
                  />

                  {/* Always visible gradient and text */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-end p-2">
                    <h4 className="text-white text-sm font-semibold truncate">
                      {folder.name}
                    </h4>
                  </div>

                  {/* Hover effect */}
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <ArrowRight className="text-white h-8 w-8" />
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {selectedFolder && (
            <button
              onClick={() => {
                setSelectedFolder(null);
                fetchRepoImages(null);
              }}
              className="mb-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition"
            >
              Back to all images
            </button>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-black/30 rounded-xl p-6 shadow-lg"
          >
            <h3 className="text-2xl font-semibold mb-4 drop-shadow">
              {selectedFolder
                ? `Images in ${selectedFolder.name}`
                : "All Images"}
            </h3>
            <PhotoGrid images={repoImages} />
          </motion.div>
        </div>
      </div>

      {/* Passphrase Modal */}
      {showPassphraseModal && selectedFolder && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-lg shadow-lg text-black max-w-sm w-full">
            <h3 className="text-xl font-semibold mb-4">
              Enter Passphrase for {selectedFolder.name}
            </h3>
            <input
              type="password"
              placeholder="Passphrase"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handlePassphraseSubmit()}
              className="border p-2 rounded w-full mb-2"
            />
            {passphraseError && (
              <p className="text-red-500 text-sm mb-2">{passphraseError}</p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => {
                  setShowPassphraseModal(false);
                  setPassphrase("");
                  setPassphraseError("");
                }}
                className="px-4 py-2 rounded border"
              >
                Cancel
              </button>
              <button
                onClick={handlePassphraseSubmit}
                className="px-4 py-2 rounded bg-blue-600 text-white"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
