"use client";

import { useState, useMemo, useEffect } from "react";
import JustifiedPhotoGrid from "./gallery/JustifiedPhotoGrid";
import { useGalleryPagination } from "../hooks/use-gallery-pagination";
import {
  Search,
  Filter,
  Grid3x3,
  List,
  Download,
  Eye,
  RefreshCw,
  ArrowRight,
} from "lucide-react";
import type { Folder, Image as GalleryImage } from "@/app/types/gallery";
import EnhancedGalleryItem from "./GalleryGridItem";
import PhotoGrid from "./gallery/PhotoGrid";
import { motion, AnimatePresence } from "framer-motion";

interface EnhancedGalleryProps {
  images: GalleryImage[];
  folderId?: string;
  onRefresh?: () => void;
  showUpload?: boolean;
}

type ViewMode = "justified" | "grid" | "list";
type SortBy = "newest" | "oldest" | "name" | "size";

export default function RepoGallery({
  images,
  folderId,
  onRefresh,
  showUpload = true,
}: EnhancedGalleryProps) {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [showPassphraseModal, setShowPassphraseModal] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [passphraseError, setPassphraseError] = useState("");
  const [repoImages, setRepoImages] = useState<GalleryImage[]>([]);

  // If caller doesn't provide `images` (e.g. app/page.tsx just renders <RepoGallery />),
  // fetch images client-side from the repo API so the gallery still works.
  const [fetchedImages, setFetchedImages] = useState<GalleryImage[] | null>(
    null,
  );

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

  // Use images prop when provided; otherwise use fetched images or empty array
  const imagesToUse: GalleryImage[] =
    images !== undefined ? images : repoImages ?? [];
  const itemsPerPage = 50;
  const [viewMode, setViewMode] = useState<ViewMode>("justified");
  const [sortBy, setSortBy] = useState<SortBy>("newest");
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedType, setSelectedType] = useState<"all" | "image" | "video">(
    "all",
  );

  // Filter configuration
  const filterBy = useMemo(() => {
    const filters: any = {};

    if (selectedType !== "all") {
      filters.type = selectedType;
    }

    if (searchTerm) {
      filters.searchTerm = searchTerm;
    }

    return filters;
  }, [selectedType, searchTerm]);

  // Use pagination hook
  const {
    paginatedImages,
    allImages,
    currentPage,
    totalPages,
    totalImages,
    hasMore,
    isLoading,
    loadMore,
    resetPagination,
    newImageIds,
    markImagesAsViewed,
  } = useGalleryPagination({
    images: imagesToUse,
    itemsPerPage: itemsPerPage,
    sortBy,
    filterBy,
  });

  // Handle search
  const handleSearch = (term: string) => {
    setSearchTerm(term);
    resetPagination();
  };

  // Handle sort change
  const handleSortChange = (newSort: SortBy) => {
    setSortBy(newSort);
    resetPagination();
  };

  // Handle type filter
  const handleTypeFilter = (type: "all" | "image" | "video") => {
    setSelectedType(type);
    resetPagination();
  };

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm("");
    setSelectedType("all");
    resetPagination();
  };

  // Get view mode icon
  const getViewModeIcon = () => {
    switch (viewMode) {
      case "justified":
        return <List className="w-4 h-4" />;
      case "grid":
        return <Grid3x3 className="w-4 h-4" />;
      default:
        return <List className="w-4 h-4" />;
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

        {(!selectedFolder && images === undefined) ? ( // Only show folders if no specific folder is selected and images aren't provided by prop
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
          </div>
        ) : ( // Show images if a folder is selected or images prop was provided
          <>
            {(selectedFolder && images === undefined) && (
              <button
                onClick={() => {
                  setSelectedFolder(null);
                  fetchRepoImages(null);
                  resetPagination(); // Reset pagination when going back to all images
                }}
                className="mb-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white transition"
              >
                Back to all images
              </button>
            )}

            <div className="w-full min-h-screen bg-gray-50">
              {/* Header Controls */}
              <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-sm border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 py-4">
                  {/* Top Row - Search and View Controls */}
                  <div className="flex items-center justify-between gap-4 mb-4">
                    {/* Search */}
                    <div className="relative flex-1 max-w-md">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Search images..."
                        value={searchTerm}
                        onChange={(e) => handleSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>

                    {/* View Mode Toggle */}
                    <div className="flex items-center gap-2">
                      <div className="flex bg-gray-100 rounded-lg p-1">
                        <button
                          onClick={() => setViewMode("justified")}
                          className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                            viewMode === "justified"
                              ? "bg-white text-blue-600 shadow-sm"
                              : "text-gray-600 hover:text-gray-800"
                          }`}
                        >
                          Justified
                        </button>
                        <button
                          onClick={() => setViewMode("grid")}
                          className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                            viewMode === "grid"
                              ? "bg-white text-blue-600 shadow-sm"
                              : "text-gray-600 hover:text-gray-800"
                          }`}
                        >
                          Grid
                        </button>
                      </div>

                      {/* Filter Toggle */}
                      <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`p-2 rounded-lg transition-all ${
                          showFilters
                            ? "bg-blue-100 text-blue-600"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        <Filter className="w-4 h-4" />
                      </button>

                      {/* Refresh */}
                      {onRefresh && (
                        <button
                          onClick={onRefresh}
                          className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-all"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Filter Panel */}
                  <AnimatePresence>
                    {showFilters && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="flex items-center gap-4 pb-4">
                          {/* Type Filter */}
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">
                              Type
                            </label>
                            <select
                              value={selectedType}
                              onChange={(e) =>
                                handleTypeFilter(e.target.value as any)
                              }
                              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="all">All</option>
                              <option value="image">Images</option>
                              <option value="video">Videos</option>
                            </select>
                          </div>

                          {/* Sort By */}
                          <div>
                            <label className="text-sm font-medium text-gray-700 mb-1 block">
                              Sort By
                            </label>
                            <select
                              value={sortBy}
                              onChange={(e) =>
                                handleSortChange(e.target.value as SortBy)
                              }
                              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                              <option value="newest">Newest First</option>
                              <option value="oldest">Oldest First</option>
                              <option value="name">Name A-Z</option>
                              <option value="size">Size (Largest First)</option>
                            </select>
                          </div>

                          {/* Clear Filters */}
                          {(searchTerm || selectedType !== "all") && (
                            <button
                              onClick={clearFilters}
                              className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                            >
                              Clear All
                            </button>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Stats Bar */}
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <div className="flex items-center gap-4">
                      <span>
                        {totalImages} {totalImages === 1 ? "image" : "images"}
                      </span>
                      {newImageIds.size > 0 && (
                        <span className="flex items-center gap-1 text-green-600">
                          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                          {newImageIds.size} new
                        </span>
                      )}
                    </div>

                    {allImages.length > 0 && (
                      <div className="flex items-center gap-2">
                        <span>
                          Page {currentPage} of {totalPages}
                        </span>
                        <span>•</span>
                        <span>{paginatedImages.length} shown</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Gallery Content */}
              <div className="max-w-7xl mx-auto px-4 py-6">
                {paginatedImages.length === 0 ? (
                  <div className="text-center py-20">
                    <div className="text-gray-400 mb-4">
                      <Eye className="w-16 h-16 mx-auto" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">
                      {searchTerm || selectedType !== "all"
                        ? "No images found"
                        : "No images yet"}
                    </h3>
                    <p className="text-gray-500 mb-6">
                      {searchTerm || selectedType !== "all"
                        ? "Try adjusting your search or filters"
                        : "Upload some images to get started"}
                    </p>
                    {(searchTerm || selectedType !== "all") && (
                      <button
                        onClick={clearFilters}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                      >
                        Clear Filters
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Enhanced Justified Grid */}
                    {viewMode === "justified" && (
                      <JustifiedPhotoGrid
                        images={paginatedImages}
                        newImageIds={newImageIds}
                        itemsPerPage={50}
                      />
                    )}

                    {/* Grid View */}
                    {viewMode === "grid" && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {paginatedImages.map((image, index) => (
                          <EnhancedGalleryItem
                            key={image.id}
                            image={image}
                            onSelect={() => {}} // Add lightbox support for grid view
                            isNew={newImageIds.has(image.id)}
                          />
                        ))}
                      </div>
                    )}

                    {/* Load More Button */}
                    {hasMore && (
                      <div className="flex justify-center mt-12">
                        <button
                          onClick={() => loadMore()}
                          disabled={isLoading}
                          className="flex items-center gap-3 px-8 py-4 bg-white border border-gray-200 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md"
                        >
                          {isLoading ? (
                            <>
                              <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
                              <span>Loading...</span>
                            </>
                          ) : (
                            <>
                              <span>Load More Images</span>
                              <span className="text-sm text-gray-500">
                                (
                                {Math.min(
                                  itemsPerPage,
                                  totalImages - currentPage * itemsPerPage,
                                )}{" "}
                                remaining)
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        )}
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
