"use client";

import { MdLock } from "react-icons/md";
import { FiChevronDown, FiFolder } from "react-icons/fi";
import { useEffect, useMemo, useState } from "react";

interface Category {
  id: string;
  name: string;
  isPrivate?: boolean;
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
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

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
      | { type: "group"; group: { id: string; name: string; position: number; items: Category[] } }
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

  // 2. Auto-open group if active folder is inside it, close others
  useEffect(() => {
    const current = categories.find((cat) => cat.id === activeFolder);
    const groupId = current?.group?.id;
    if (groupId) {
      setOpenGroups((prev) => {
        const newState: Record<string, boolean> = {};
        for (const key in prev) {
          newState[key] = false;
        }
        newState[groupId] = true;
        return newState;
      });
    } else {
      // Close all groups if selecting a folder outside of groups
      setOpenGroups({});
    }
  }, [activeFolder, categories]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  const renderCard = (cat: Category, isSubItem = false) => {
    const thumbnailPath = cat.thumbnail?.variants?.[0]?.path;
    const isActive = activeFolder === cat.id;
    // Ensure path is absolute and properly formatted
    const absoluteThumbnailPath = thumbnailPath?.startsWith('/') 
      ? thumbnailPath 
      : thumbnailPath ? `/${thumbnailPath}` : null;

    return (
      <button
        type="button"
        key={cat.id}
        onClick={() => onSelectCategory(cat.id)}
        className={`group relative w-full overflow-hidden rounded-xl border transition-all duration-300 text-left ${
          isActive
            ? "border-[var(--primary)] shadow-lg scale-[1.02] z-10"
            : "border-[var(--foreground)]/15 hover:border-[var(--foreground)]/30"
        } ${isSubItem ? "bg-[var(--card)]/50" : ""}`}
      >
        <div className="relative w-full aspect-[3/2] bg-[var(--card)] overflow-hidden">
          {absoluteThumbnailPath ? (
            <div
              className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110"
              style={{ backgroundImage: `url('${absoluteThumbnailPath}')` }}
              onError={(e) => {
                // Fallback if image fails to load
                (e.target as HTMLElement).style.backgroundImage = 'none';
              }}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--card)] to-[var(--background)] opacity-50" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          
          {cat.isPrivate && (
            <div className="absolute top-2 right-2">
              <div className="p-1 bg-black/40 backdrop-blur-md rounded-full border border-white/10">
                <MdLock size={12} className="text-white" />
              </div>
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-white text-[11px] font-bold truncate tracking-wide uppercase">
                {cat.name}
              </p>
              {cat._count?.files !== undefined && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/20 text-white backdrop-blur-sm">
                  {cat._count.files}
                </span>
              )}
            </div>
          </div>
        </div>
      </button>
    );
  };

  const renderGroupCard = (group: { id: string; name: string; position: number; items: Category[] }) => {
    const isOpen = openGroups[group.id];
    const thumbPaths = group.items
      .map((cat) => {
        const path = cat.thumbnail?.variants?.[0]?.path;
        // Ensure paths are absolute
        return path?.startsWith('/') ? path : path ? `/${path}` : null;
      })
      .filter((path): path is string => path !== null)
      .slice(0, 4);

    return (
      <button
        type="button"
        onClick={() => toggleGroup(group.id)}
        className={`group relative w-full aspect-[3/2] overflow-hidden rounded-xl border transition-all duration-300 ${
          isOpen 
            ? "border-[var(--primary)] ring-4 ring-[var(--primary)]/10" 
            : "border-[var(--foreground)]/15 hover:border-[var(--foreground)]/40"
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
        
        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
        
        <div className="absolute top-2 left-2">
          <div className="p-1.5 bg-white/10 backdrop-blur-md rounded-lg border border-white/20">
            <FiFolder size={14} className="text-white" />
          </div>
        </div>

        <div className="absolute top-2 right-2 flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-white bg-[var(--primary)] px-2 py-0.5 rounded-full">
            {group.items.length}
          </span>
          <div className={`transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}>
            <FiChevronDown size={16} className="text-white" />
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
          <p className="text-white text-[11px] font-bold uppercase tracking-widest">{group.name}</p>
          <p className="text-white/60 text-[9px] font-medium uppercase mt-0.5">Collection</p>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-6 mb-12">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-2xl font-bold text-[var(--foreground)] tracking-tight">Folder list</h2>
      </div>

      <div className="rounded-3xl border border-[var(--foreground)]/10 bg-[var(--background)] p-4 md:p-6 shadow-2xl">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-4">
          
          {/* 1. All Category */}
          {allCategory && (
            <div className="col-span-1">
              {renderCard(allCategory)}
            </div>
          )}

          {/* 2. Groups and Standalone Folders */}
          {orderedItems.map((item, _index) => {
            if (item.type === "group") {
              return (
                <div key={`group-wrapper-${item.group.id}`} className="col-span-1">
                  {renderGroupCard(item.group)}
                </div>
              );
            }

            return (
              <div key={item.folder.id} className="col-span-1">
                {renderCard(item.folder)}
              </div>
            );
          })}
        </div>

        {/* Expanded Group Sections - Outside Main Grid */}
        {orderedItems.map((item) => {
          if (item.type === "group") {
            const isOpen = openGroups[item.group.id];
            return isOpen ? (
              <div key={`expanded-${item.group.id}`} className="mt-6 bg-[var(--foreground)]/[0.02] rounded-2xl p-4 border border-[var(--foreground)]/5 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-3 mb-4 opacity-60">
                  <div className="h-px flex-1 bg-[var(--foreground)]/10" />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em]">
                    Inside {item.group.name}
                  </span>
                  <div className="h-px flex-1 bg-[var(--foreground)]/10" />
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-4">
                  {item.group.items.map((sub) => (
                    <div key={sub.id} className="col-span-1">
                      {renderCard(sub, true)}
                    </div>
                  ))}
                </div>
              </div>
            ) : null;
          }
          return null;
        })}
      </div>
    </div>
  );
}