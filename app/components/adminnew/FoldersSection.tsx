"use client";

import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Folder as FolderIcon,
  FolderTree,
  Images,
  KeyRound,
  Link2,
  Lock,
  Pencil,
  Save,
  Trash2,
  Unlock,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import type useFolderOrdering from "@/app/components/admin/hooks/useFolderOrdering";
import type { Folder, FolderGroup } from "@/app/components/admin/types";
import {
  getFolderCover,
  getFolderVisibility,
  getSharePath,
  getUnlockedPath,
} from "./folderMeta";
import type { ToastKind } from "./types";
import { Badge, EmptyState, SectionHeader } from "./ui";

type OrderingApi = ReturnType<typeof useFolderOrdering>;

export default function FoldersSection({
  folders,
  groups,
  activeFolderId,
  onSelectFolder,
  ordering,
  onCreateFolder,
  onEditFolder,
  onDeleteFolder,
  onManageGroups,
  onCreateAccessLink,
  onOpenLibrary,
  onNotify,
}: {
  folders: Folder[];
  groups: FolderGroup[];
  activeFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  ordering: OrderingApi;
  onCreateFolder: () => void;
  onEditFolder: (folder: Folder) => void;
  onDeleteFolder: (folder: Folder) => void;
  onManageGroups: () => void;
  onCreateAccessLink: (folderId: string) => Promise<string>;
  onOpenLibrary: (folderId?: string) => void;
  onNotify: (kind: ToastKind, message: string) => void;
}) {
  const [accessLink, setAccessLink] = useState<string | null>(null);
  const [creatingLink, setCreatingLink] = useState(false);

  const {
    effectiveOrderItems,
    folderListItems,
    isOrderDirty,
    savingOrderItems,
    toggleGroupOpen,
    getFolderIndex,
    moveFolderByDelta,
    saveCurrentOrder,
  } = ordering;

  const activeFolder =
    folders.find((folder) => folder.id === activeFolderId) ?? null;
  const selectedOrderIndex = getFolderIndex(activeFolderId);
  const orderCount = effectiveOrderItems.length;
  const canMoveUp = selectedOrderIndex !== null && selectedOrderIndex > 0;
  const canMoveDown =
    selectedOrderIndex !== null && selectedOrderIndex < orderCount - 1;

  useEffect(() => {
    setAccessLink(null);
  }, [activeFolderId]);

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      onNotify("success", `${label} copied`);
    } catch {
      onNotify("error", "Failed to copy link");
    }
  };

  const handleCreateAccessLink = async () => {
    if (!activeFolder) return;

    setCreatingLink(true);
    try {
      const link = await onCreateAccessLink(activeFolder.id);
      setAccessLink(link);
      await copyText(link, "Access link");
    } catch (err) {
      onNotify(
        "error",
        err instanceof Error ? err.message : "Failed to create access link",
      );
    } finally {
      setCreatingLink(false);
    }
  };

  const activeVisibility = activeFolder
    ? getFolderVisibility(activeFolder)
    : null;
  const activeCover = activeFolder ? getFolderCover(activeFolder) : null;

  return (
    <>
      <SectionHeader
        title="Folders"
        description="Create folders, control visibility, arrange gallery order, and manage share links."
        actions={
          <>
            <button
              type="button"
              className="an-btn an-btn-soft"
              onClick={onManageGroups}
            >
              <FolderTree size={14} />
              Manage groups
            </button>
            <button
              type="button"
              className="an-btn an-btn-primary"
              onClick={onCreateFolder}
            >
              <FolderIcon size={14} />
              New folder
            </button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="an-panel overflow-hidden">
          <div className="an-panel-head items-center">
            <div>
              <h2 className="text-[13px] font-semibold">All folders</h2>
              <p className="mt-0.5 text-[11px] text-[var(--an-muted)]">
                {folders.length} folder{folders.length === 1 ? "" : "s"} ·{" "}
                {groups.length} group{groups.length === 1 ? "" : "s"}
              </p>
            </div>

            {selectedOrderIndex !== null && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[11px] text-[var(--an-muted)]">
                  Order {selectedOrderIndex + 1} of {orderCount}
                </span>
                <button
                  type="button"
                  className="an-icon-btn h-7 w-7"
                  onClick={() =>
                    activeFolder && moveFolderByDelta(activeFolder.id, -1)
                  }
                  disabled={!canMoveUp}
                  aria-label="Move folder up"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  className="an-icon-btn h-7 w-7"
                  onClick={() =>
                    activeFolder && moveFolderByDelta(activeFolder.id, 1)
                  }
                  disabled={!canMoveDown}
                  aria-label="Move folder down"
                >
                  <ArrowDown size={14} />
                </button>
                {isOrderDirty && (
                  <button
                    type="button"
                    className="an-btn an-btn-primary an-btn-xs"
                    onClick={() => void saveCurrentOrder()}
                    disabled={savingOrderItems}
                  >
                    <Save size={12} />
                    {savingOrderItems ? "Saving…" : "Save order"}
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="an-panel-body p-2">
            {folders.length === 0 ? (
              <EmptyState
                icon={<FolderIcon size={22} />}
                title="No folders yet"
                description="Create your first folder to start organizing media."
                action={
                  <button
                    type="button"
                    className="an-btn an-btn-primary an-btn-xs"
                    onClick={onCreateFolder}
                  >
                    <FolderIcon size={13} />
                    New folder
                  </button>
                }
              />
            ) : (
              <div className="space-y-0.5">
                {folderListItems.map((item) => {
                  if (item.type === "group") {
                    return (
                      <div
                        key={`group-${item.group.id}`}
                        className="an-folder-row"
                      >
                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-center gap-2"
                          onClick={() => toggleGroupOpen(item.group.id)}
                          aria-expanded={item.isOpen}
                        >
                          <ChevronRight
                            size={14}
                            className={`shrink-0 text-[var(--an-muted)] transition-transform ${
                              item.isOpen ? "rotate-90" : ""
                            }`}
                          />
                          <FolderTree
                            size={14}
                            className="shrink-0 text-[var(--an-muted)]"
                          />
                          <span className="truncate text-[12px] font-medium">
                            {item.group.name}
                          </span>
                          <span className="ml-auto text-[11px] text-[var(--an-muted)]">
                            {item.count}
                          </span>
                        </button>
                      </div>
                    );
                  }

                  const { folder } = item;
                  const visibility = getFolderVisibility(folder);
                  const cover = getFolderCover(folder);

                  return (
                    <div
                      key={`folder-${folder.id}`}
                      className="an-folder-row group"
                      data-active={activeFolderId === folder.id}
                      style={{ paddingLeft: item.indent ? 26 : 8 }}
                    >
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-2"
                        onClick={() => onSelectFolder(folder.id)}
                      >
                        <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded border border-[var(--an-border)] bg-[var(--an-surface)]">
                          {cover ? (
                            <Image
                              src={cover}
                              alt=""
                              fill
                              unoptimized
                              sizes="28px"
                              className="object-cover"
                            />
                          ) : (
                            <span className="flex h-full items-center justify-center text-[var(--an-muted)]">
                              <FolderIcon size={13} />
                            </span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] font-medium">
                            {folder.name}
                          </span>
                          <span className="block truncate text-[10.5px] text-[var(--an-muted)]">
                            /f/{folder.uniqueUrl}
                          </span>
                        </span>
                        <Badge tone={visibility.tone}>
                          {visibility.label}
                        </Badge>
                        {folder.isPrivate && (
                          <Lock
                            size={12}
                            className="shrink-0 text-[var(--an-muted)]"
                            aria-label="Password protected"
                          />
                        )}
                      </button>

                      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                        <button
                          type="button"
                          className="an-icon-btn h-7 w-7"
                          onClick={() => onEditFolder(folder)}
                          aria-label={`Edit ${folder.name}`}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          className="an-icon-btn an-icon-btn-danger h-7 w-7"
                          onClick={() => onDeleteFolder(folder)}
                          aria-label={`Delete ${folder.name}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <aside className="an-panel self-start overflow-hidden">
          {!activeFolder || !activeVisibility ? (
            <EmptyState
              icon={<FolderTree size={22} />}
              title="No folder selected"
              description="Select a folder to review its visibility, links, and cover."
            />
          ) : (
            <>
              <div className="relative aspect-[16/9] bg-[var(--an-surface-2)]">
                {activeCover ? (
                  <Image
                    src={activeCover}
                    alt=""
                    fill
                    unoptimized
                    sizes="320px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-[var(--an-muted)]">
                    <Images size={24} />
                  </div>
                )}
              </div>

              <div className="an-panel-body space-y-4">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate text-[15px] font-semibold">
                        {activeFolder.name}
                      </h2>
                      <p className="truncate text-[11px] text-[var(--an-muted)]">
                        /f/{activeFolder.uniqueUrl}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="an-icon-btn h-7 w-7 shrink-0"
                      onClick={() => onEditFolder(activeFolder)}
                      aria-label="Edit folder"
                    >
                      <Pencil size={13} />
                    </button>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge tone={activeVisibility.tone}>
                      {activeVisibility.label}
                    </Badge>
                    {activeFolder.isPrivate && (
                      <Badge tone="danger">
                        <Lock size={10} />
                        Private
                      </Badge>
                    )}
                    {activeFolder.group && (
                      <Badge tone="neutral">{activeFolder.group.name}</Badge>
                    )}
                  </div>
                </div>

                <div className="an-divider" />

                <div className="space-y-2">
                  <p className="an-label">Actions</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className="an-btn an-btn-primary an-btn-xs"
                      onClick={() => onOpenLibrary(activeFolder.id)}
                    >
                      <Images size={13} />
                      Library
                    </button>
                    <button
                      type="button"
                      className="an-btn an-btn-soft an-btn-xs"
                      onClick={() => onEditFolder(activeFolder)}
                    >
                      <Pencil size={13} />
                      Edit
                    </button>
                    <button
                      type="button"
                      className="an-btn an-btn-soft an-btn-xs"
                      onClick={() =>
                        void copyText(
                          `${window.location.origin}${getSharePath(activeFolder)}`,
                          "Share link",
                        )
                      }
                    >
                      <Link2 size={13} />
                      Share link
                    </button>
                    {activeFolder.isPrivate && (
                      <button
                        type="button"
                        className="an-btn an-btn-soft an-btn-xs"
                        onClick={() =>
                          void copyText(
                            `${window.location.origin}${getUnlockedPath(activeFolder)}`,
                            "Unlocked link",
                          )
                        }
                      >
                        <Unlock size={13} />
                        Unlocked
                      </button>
                    )}
                    <button
                      type="button"
                      className="an-btn an-btn-soft an-btn-xs col-span-2"
                      onClick={() => void handleCreateAccessLink()}
                      disabled={creatingLink}
                    >
                      <KeyRound size={13} />
                      {creatingLink
                        ? "Creating access link…"
                        : "Create one-time access link"}
                    </button>
                  </div>
                  {accessLink && (
                    <p className="an-inset break-all p-2 text-[11px] text-[var(--an-muted)]">
                      {accessLink}
                    </p>
                  )}
                </div>

                <div className="an-divider" />

                <dl className="space-y-1.5 text-[11px] text-[var(--an-muted)]">
                  <div className="flex justify-between gap-3">
                    <dt>Visibility</dt>
                    <dd className="text-[var(--an-text-soft)]">
                      {activeVisibility.label}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Group</dt>
                    <dd className="truncate text-[var(--an-text-soft)]">
                      {activeFolder.group?.name ?? "None"}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Protection</dt>
                    <dd className="text-[var(--an-text-soft)]">
                      {activeFolder.isPrivate ? "Passphrase" : "Public link"}
                    </dd>
                  </div>
                </dl>

                <button
                  type="button"
                  className="an-btn an-btn-danger an-btn-xs w-full"
                  onClick={() => onDeleteFolder(activeFolder)}
                >
                  <Trash2 size={13} />
                  Delete folder
                </button>
              </div>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
