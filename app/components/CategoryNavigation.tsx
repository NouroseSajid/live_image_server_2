"use client";

import { MdLock } from "react-icons/md";
import { FiChevronDown, FiFolder, FiX } from "react-icons/fi";
import { useEffect, useMemo, useState } from "react";

interface Category {
  id: string;
  name: string;
  isPrivate?: boolean;
  folderThumb?: string | null;
  group?: {
    id: string;
    name: string;
    position?: number;
  } | null;
  thumbnail?: {
    id: string;
    variants: Array<{
      path: string;
    }>;
  } | null;
  _count?: {
    files: number;
  };
}

interface Group {
  id: string;
  name: string;
  position: number;
  items: Category[];
}

interface CategoryNavigationProps {
  categories: Category[];
  orderItems?: Array<{ type: "folder" | "group"; id: string }> | null;
  activeFolder: string;
  onSelectCategory: (category: string) => void;
}

export default function CategoryNavigation({
  categories,
  orderItems,
  activeFolder,
  onSelectCategory,
}: CategoryNavigationProps) {
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

  const resolveThumbnailPath = (path: string | null | undefined) => {
    if (!path) return null;
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    if (path.startsWith("/images/")) {
      return path.replace(/^\/images\//, "/api/serve/");
    }
    if (path.startsWith("/")) return path;
    return `/${path}`;
  };

  // 1. Logic to organize categories and groups
  const { allCategory, orderedItems } = useMemo(() => {
    const all = categories.find((cat) => cat.id === "all") || null;
    const folderItems = categories.filter((cat) => cat.id !== "all");

    const groupedMap = new Map<
      string,
      { id: string; name: string; position: number; items: Category[] }
    >();

    folderItems.forEach((cat) => {
      if (!cat.group?.id) return;
      if (!groupedMap.has(cat.group.id)) {
        groupedMap.set(cat.group.id, {
          id: cat.group.id,
          name: cat.group.name,
          position: cat.group.position ?? 0,
          items: [],
        });
      }
      groupedMap.get(cat.group.id)?.items.push(cat);
    });

    const items: Array<
      | { type: "group"; group: Group }
      | { type: "folder"; folder: Category }
    > = [];

    const folderMap = new Map(folderItems.map((cat) => [cat.id, cat]));
    const groupMap = new Map(groupedMap);

    const ordered = Array.isArray(orderItems) && orderItems.length > 0
      ? orderItems
      : folderItems.map((cat) => ({ type: "folder" as const, id: cat.id }));

    const seenGroups = new Set<string>();
    const seenFolders = new Set<string>();

    ordered.forEach((item) => {
      if (item.type === "group") {
        const group = groupMap.get(item.id);
        if (!group || seenGroups.has(group.id)) return;
        items.push({ type: "group", group });
        seenGroups.add(group.id);
        return;
      }
      const folder = folderMap.get(item.id);
      if (!folder || seenFolders.has(folder.id) || folder.group?.id) return;
      items.push({ type: "folder", folder });
      seenFolders.add(folder.id);
    });

    // Catch-all for items not in orderItems
    groupMap.forEach((group) => {
      if (!seenGroups.has(group.id)) {
        items.push({ type: "group", group });
        seenGroups.add(group.id);
      }
    });
    folderMap.forEach((folder) => {
      if (!seenFolders.has(folder.id) && !folder.group?.id) {
        items.push({ type: "folder", folder });
        seenFolders.add(folder.id);
      }
    });

    return { allCategory: all, orderedItems: items };
  }, [categories, orderItems]);

  // 2. Auto-open group drawer if active folder is inside it
  useEffect(() => {
    const current = categories.find((cat) => cat.id === activeFolder);
    const groupId = current?.group?.id;
    if (groupId) {
      const groupData = (orderedItems.find(item => item.type === 'group' && item.group.id === groupId) as any)?.group;
      if (groupData) {
        setSelectedGroup(groupData);
      }
    }
  }, [activeFolder, categories, orderedItems]);

  // Prevent background scroll when drawer is open
  useEffect(() => {
    if (selectedGroup) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [selectedGroup]);

  const renderCard = (cat: Category, isSubItem = false) => {
    const thumbnailVariant = cat.thumbnail?.variants?.find((variant) => variant.path);
    const thumbnailPath = cat.folderThumb || thumbnailVariant?.path;
    const isActive = activeFolder === cat.id;
    const absoluteThumbnailPath = resolveThumbnailPath(thumbnailPath);

    return (
      <button
        type="button"
        key={cat.id}
        onClick={() => {
          onSelectCategory(cat.id);
          if (isSubItem) setSelectedGroup(null);
        }}
        className={`group relative w-full overflow-hidden rounded-xl border transition-all duration-300 text-left ${
          isActive
            ? "border-[var(--primary)] shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)] ring-2 ring-[var(--primary)]/20 scale-[1.02] z-10 bg-[var(--primary)]/5"
            : "border-[var(--foreground)]/15 hover:border-[var(--foreground)]/30 hover:scale-[1.01]"
        } ${isSubItem ? "bg-[var(--card)]/50" : ""}`}
      >
        <div className="relative w-full aspect-[3/2] bg-[var(--card)] overflow-hidden">
          {absoluteThumbnailPath ? (
            <div
              className={`absolute inset-0 bg-cover bg-center blur-[1px] transition-all duration-700 ${
                isActive ? "opacity-100 scale-105" : "opacity-60 group-hover:opacity-80 group-hover:scale-110"
              }`}
              style={{ backgroundImage: `url('${absoluteThumbnailPath}')` }}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--card)] to-[var(--background)] opacity-50" />
          )}
          <div className={`absolute inset-0 bg-gradient-to-t transition-opacity duration-300 ${
            isActive ? "from-black/80 via-black/40 to-transparent" : "from-black/70 via-black/40 to-black/20"
          } backdrop-blur-[1px]`} />
          
          {isActive && (
            <div className="absolute inset-0 border-2 border-[var(--primary)]/30 rounded-xl pointer-events-none" />
          )}

          {cat.isPrivate && (
            <div className="absolute top-2 right-2">
              <div className="p-1 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
                <MdLock size={12} className="text-white" />
              </div>
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className={`text-[11px] font-bold truncate tracking-wide uppercase transition-colors duration-300 ${
                isActive ? "text-[var(--primary)]" : "text-white"
              }`}>
                {cat.name}
              </p>
              {cat._count?.files !== undefined && (
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded backdrop-blur-sm transition-colors duration-300 ${
                  isActive ? "bg-[var(--primary)] text-white" : "bg-white/20 text-white"
                }`}>
                  {cat._count.files}
                </span>
              )}
            </div>
          </div>
        </div>
      </button>
    );
  };

  const renderGroupCard = (group: Group) => {
    const thumbPaths = group.items
      .map((cat) => {
        const thumbPath = cat.folderThumb || cat.thumbnail?.variants?.find((item) => item.path)?.path;
        return resolveThumbnailPath(thumbPath);
      })
      .filter((path): path is string => path !== null)
      .slice(0, 4);

    const isAnyActive = group.items.some(item => item.id === activeFolder);

    return (
      <button
        type="button"
        onClick={() => setSelectedGroup(group)}
        className={`group relative w-full aspect-[3/2] overflow-hidden rounded-xl border transition-all duration-300 ${
          isAnyActive 
            ? "border-[var(--primary)] shadow-[0_0_15px_rgba(var(--primary-rgb),0.2)] scale-[1.01]" 
            : "border-[var(--foreground)]/15 hover:border-[var(--foreground)]/40 hover:scale-[1.01]"
        }`}
      >
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0.5 bg-[var(--foreground)]/5 p-0.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="relative bg-[var(--card)] overflow-hidden">
              {thumbPaths[i] ? (
                <div 
                  className="absolute inset-0 bg-cover bg-center" 
                  style={{ backgroundImage: `url('${thumbPaths[i]}')` }} 
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-[var(--card)] to-[var(--background)] opacity-30" />
              )}
            </div>
          ))}
        </div>
        
        <div className={`absolute inset-0 transition-colors duration-300 ${
          isAnyActive ? "bg-black/50 backdrop-blur-md" : "bg-black/40 backdrop-blur-md group-hover:bg-black/30"
        }`} />
        
        <div className="absolute top-2 left-2">
          <div className={`p-1.5 backdrop-blur-md rounded-lg border transition-colors duration-300 ${
            isAnyActive ? "bg-[var(--primary)]/20 border-[var(--primary)]/40" : "bg-white/10 border-white/20"
          }`}>
            <FiFolder size={14} className={isAnyActive ? "text-[var(--primary)]" : "text-white"} />
          </div>
        </div>

        <div className="absolute top-2 right-2 flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-white bg-[var(--primary)] px-2 py-0.5 rounded-full shadow-lg shadow-[var(--primary)]/20">
            {group.items.length}
          </span>
          <div className="text-white opacity-60">
            <FiChevronDown size={16} />
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
          <p className={`text-[11px] font-bold uppercase tracking-widest transition-colors duration-300 ${
            isAnyActive ? "text-[var(--primary)]" : "text-white"
          }`}>{group.name}</p>
          <p className="text-white/60 text-[9px] font-medium uppercase mt-0.5">Collection</p>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-4 mb-12">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-2xl font-bold text-[var(--foreground)] tracking-tight">Folders</h2>
      </div>

      <div className="group/nav relative rounded-3xl border border-[var(--foreground)]/10 bg-[var(--background)] p-4 md:p-6 shadow-2xl">
        <div className="flex overflow-x-auto pb-4 gap-4 snap-x snap-mandatory folder-scrollbar transition-colors duration-300">
          {/* 1. All Category */}
          {allCategory && (
            <div className="flex-shrink-0 w-[160px] md:w-[200px] snap-start">
              {renderCard(allCategory)}
            </div>
          )}

          {/* 2. Groups and Standalone Folders */}
          {orderedItems.map((item, _index) => {
            if (item.type === "group") {
              return (
                <div key={`group-wrapper-${item.group.id}`} className="flex-shrink-0 w-[160px] md:w-[200px] snap-start">
                  {renderGroupCard(item.group)}
                </div>
              );
            }

            return (
              <div key={item.folder.id} className="flex-shrink-0 w-[160px] md:w-[200px] snap-start">
                {renderCard(item.folder)}
              </div>
            );
          })}
        </div>
      </div>

      {/* Drawer Overlay */}
      {selectedGroup && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div 
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setSelectedGroup(null)}
          />
          
          <div className="relative w-full max-w-2xl bg-[var(--background)] rounded-t-3xl sm:rounded-3xl border border-[var(--foreground)]/10 shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-10 duration-300">
            {/* Drawer Header */}
            <div className="sticky top-0 z-10 bg-[var(--background)]/80 backdrop-blur-md border-b border-[var(--foreground)]/5 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[var(--primary)]/10 rounded-xl">
                  <FiFolder className="text-[var(--primary)]" size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider">{selectedGroup.name}</h3>
                  <p className="text-[10px] text-[var(--foreground)]/50 uppercase font-medium">{selectedGroup.items.length} Folders inside</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedGroup(null)}
                className="p-2 hover:bg-[var(--foreground)]/5 rounded-full transition-colors"
              >
                <FiX size={20} />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="p-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pb-8">
                {selectedGroup.items.map((sub) => (
                  <div key={sub.id} className="col-span-1">
                    {renderCard(sub, true)}
                  </div>
                ))}
              </div>
            </div>

            {/* Mobile "Pull-down" handle visual */}
            <div className="absolute top-1.5 left-1/2 -translate-x-1/2 w-12 h-1 bg-[var(--foreground)]/10 rounded-full sm:hidden" />
          </div>
        </div>
      )}
    </div>
  );
}
