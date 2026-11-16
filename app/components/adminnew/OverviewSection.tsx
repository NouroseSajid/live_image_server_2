"use client";

import { FolderPlus, Images, Inbox, Plus } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import type { Folder } from "@/app/components/admin/types";
import { getPreviewFromVariants } from "@/app/components/admin/fileUtils";
import type { ImageRequestEntry } from "@/app/components/admin/types";
import { getFolderCover, getFolderVisibility } from "./folderMeta";
import { Badge, EmptyState, SectionHeader, Stat } from "./ui";

const formatShortDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

export default function OverviewSection({
  folders,
  groupCount,
  pendingCount,
  loading,
  onOpenFolder,
  onOpenLibrary,
  onCreateFolder,
  onViewAllFolders,
  onViewRequests,
}: {
  folders: Folder[];
  groupCount: number;
  pendingCount: number;
  loading: boolean;
  onOpenFolder: (folderId: string) => void;
  onOpenLibrary: () => void;
  onCreateFolder: () => void;
  onViewAllFolders: () => void;
  onViewRequests: () => void;
}) {
  const [pending, setPending] = useState<ImageRequestEntry[]>([]);
  const [pendingLoading, setPendingLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/image-requests?status=PENDING")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        setPending(Array.isArray(data?.requests) ? data.requests : []);
      })
      .catch(() => {
        // The requests section handles its own errors.
      })
      .finally(() => {
        if (!cancelled) setPendingLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const galleryCount = folders.filter(
    (folder) => folder.visible && folder.inGridView && !folder.archived,
  ).length;
  const hiddenCount = folders.filter(
    (folder) => !folder.visible && !folder.archived,
  ).length;
  const visibleFolders = folders.slice(0, 6);

  return (
    <>
      <SectionHeader
        title="Overview"
        description="A summary of the library, folder visibility, and open requests."
        actions={
          <>
            <button
              type="button"
              className="an-btn an-btn-soft"
              onClick={onOpenLibrary}
            >
              <Images size={14} />
              Open library
            </button>
            <button
              type="button"
              className="an-btn an-btn-primary"
              onClick={onCreateFolder}
            >
              <Plus size={14} />
              New folder
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Folders"
          value={folders.length}
          hint={`${groupCount} group${groupCount === 1 ? "" : "s"}`}
        />
        <Stat
          label="In gallery"
          value={galleryCount}
          hint="Shown in the main gallery"
        />
        <Stat
          label="Hidden"
          value={hiddenCount}
          hint="Direct link only"
        />
        <Stat
          label="Pending requests"
          value={pendingCount}
          hint="Original file requests"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="an-panel overflow-hidden">
          <div className="an-panel-head items-center">
            <div>
              <h2 className="text-[13px] font-semibold">Folders</h2>
              <p className="mt-0.5 text-[11px] text-[var(--an-muted)]">
                Current visibility and share path.
              </p>
            </div>
            <button
              type="button"
              className="an-btn an-btn-ghost an-btn-xs"
              onClick={onViewAllFolders}
            >
              View all
            </button>
          </div>

          {loading ? (
            <p className="px-4 py-8 text-center text-[12px] text-[var(--an-muted)]">
              Loading folders…
            </p>
          ) : visibleFolders.length === 0 ? (
            <EmptyState
              icon={<FolderPlus size={22} />}
              title="No folders yet"
              description="Create a folder to start organizing uploads."
              action={
                <button
                  type="button"
                  className="an-btn an-btn-primary an-btn-xs"
                  onClick={onCreateFolder}
                >
                  <Plus size={13} />
                  New folder
                </button>
              }
            />
          ) : (
            <div>
              {visibleFolders.map((folder) => {
                const visibility = getFolderVisibility(folder);
                const cover = getFolderCover(folder);

                return (
                  <button
                    key={folder.id}
                    type="button"
                    className="an-row an-row-hover"
                    onClick={() => onOpenFolder(folder.id)}
                  >
                    <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md border border-[var(--an-border)] bg-[var(--an-surface-2)]">
                      {cover ? (
                        <Image
                          src={cover}
                          alt=""
                          fill
                          unoptimized
                          sizes="36px"
                          className="object-cover"
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center text-[var(--an-muted)]">
                          <Images size={15} />
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium">
                        {folder.name}
                      </span>
                      <span className="block truncate text-[11px] text-[var(--an-muted)]">
                        /f/{folder.uniqueUrl}
                      </span>
                    </span>
                    <Badge tone={visibility.tone}>{visibility.label}</Badge>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="an-panel overflow-hidden">
          <div className="an-panel-head items-center">
            <div>
              <h2 className="text-[13px] font-semibold">Pending requests</h2>
              <p className="mt-0.5 text-[11px] text-[var(--an-muted)]">
                Visitors asking for the original file.
              </p>
            </div>
            <button
              type="button"
              className="an-btn an-btn-ghost an-btn-xs"
              onClick={onViewRequests}
            >
              Review
            </button>
          </div>

          {pendingLoading ? (
            <p className="px-4 py-8 text-center text-[12px] text-[var(--an-muted)]">
              Loading requests…
            </p>
          ) : pending.length === 0 ? (
            <EmptyState
              icon={<Inbox size={22} />}
              title="No pending requests"
              description="New RAW file requests will appear here."
            />
          ) : (
            <div>
              {pending.slice(0, 5).map((request) => {
                const preview = getPreviewFromVariants(
                  request.file.variants,
                );

                return (
                  <button
                    key={request.id}
                    type="button"
                    className="an-row an-row-hover"
                    onClick={onViewRequests}
                  >
                    <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md border border-[var(--an-border)] bg-[var(--an-surface-2)]">
                      {preview ? (
                        <Image
                          src={preview}
                          alt=""
                          fill
                          unoptimized
                          sizes="36px"
                          className="object-cover"
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center text-[var(--an-muted)]">
                          <Inbox size={15} />
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-medium">
                        {request.file.fileName}
                      </span>
                      <span className="block truncate text-[11px] text-[var(--an-muted)]">
                        {request.file.folder.name}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11px] text-[var(--an-muted)]">
                      {formatShortDate(request.createdAt)}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
