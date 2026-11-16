"use client";

import {
  CheckCircle2,
  ExternalLink,
  Inbox,
  RefreshCw,
  RotateCcw,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { getPreviewFromVariants } from "@/app/components/admin/fileUtils";
import type { ImageRequestEntry } from "@/app/components/admin/types";
import type { BadgeTone } from "./folderMeta";
import { Badge, EmptyState, SectionHeader } from "./ui";
import useImageRequests, {
  type RequestCounts,
  type RequestStatusFilter,
} from "./useImageRequests";

const STATUS_TONE: Record<ImageRequestEntry["status"], BadgeTone> = {
  PENDING: "warning",
  FULFILLED: "success",
  DISMISSED: "neutral",
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default function RequestsSection({
  onCountsChange,
}: {
  onCountsChange: (counts: RequestCounts) => void;
}) {
  const [status, setStatus] = useState<RequestStatusFilter>("PENDING");
  const {
    requests,
    counts,
    loading,
    error,
    workingId,
    reload,
    setRequestStatus,
    deleteRequest,
  } = useImageRequests(status);

  useEffect(() => {
    onCountsChange(counts);
  }, [counts, onCountsChange]);

  const tabs: Array<{
    value: RequestStatusFilter;
    label: string;
    count: number;
  }> = [
    { value: "PENDING", label: "Pending", count: counts.PENDING },
    { value: "FULFILLED", label: "Fulfilled", count: counts.FULFILLED },
    { value: "DISMISSED", label: "Dismissed", count: counts.DISMISSED },
    {
      value: "ALL",
      label: "All",
      count: counts.PENDING + counts.FULFILLED + counts.DISMISSED,
    },
  ];

  return (
    <>
      <SectionHeader
        title="Requests"
        description="Visitors asking for the original file. Fulfilled and dismissed requests stay available for reference."
        actions={
          <button
            type="button"
            className="an-btn an-btn-soft"
            onClick={() => void reload()}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        }
      />

      <section className="an-panel overflow-hidden">
        <div className="an-panel-head items-center">
          <div>
            <h2 className="text-[13px] font-semibold">RAW file requests</h2>
            <p className="mt-0.5 text-[11px] text-[var(--an-muted)]">
              {counts.PENDING} pending · {counts.FULFILLED} fulfilled ·{" "}
              {counts.DISMISSED} dismissed
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 border-b border-[var(--an-border)] px-3">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatus(tab.value)}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-[12px] font-medium transition-colors ${
                status === tab.value
                  ? "border-[var(--an-accent)] text-[var(--an-accent)]"
                  : "border-transparent text-[var(--an-muted)] hover:text-[var(--an-text)]"
              }`}
            >
              {tab.label}
              <span className="an-badge an-badge-neutral">{tab.count}</span>
            </button>
          ))}
        </div>

        {error && (
          <div className="border-b border-[var(--an-border)] bg-[var(--an-danger-soft)] px-4 py-2.5 text-[12px] text-[var(--an-danger)]">
            {error}
          </div>
        )}

        {loading ? (
          <p className="px-4 py-12 text-center text-[12px] text-[var(--an-muted)]">
            Loading requests…
          </p>
        ) : requests.length === 0 ? (
          <EmptyState
            icon={<Inbox size={22} />}
            title={status === "PENDING" ? "No pending requests" : "Nothing here"}
            description={
              status === "PENDING"
                ? "New RAW file requests will appear here."
                : "Requests with this status will appear here."
            }
          />
        ) : (
          <div>
            {requests.map((request) => {
              const preview = getPreviewFromVariants(request.file.variants);
              const isWorking = workingId === request.id;

              return (
                <article
                  key={request.id}
                  className="flex flex-col gap-3 border-b border-[var(--an-border)] p-4 last:border-b-0 sm:flex-row sm:items-start"
                >
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-[var(--an-border)] bg-[var(--an-surface-2)]">
                    {preview ? (
                      <Image
                        src={preview}
                        alt=""
                        fill
                        unoptimized
                        sizes="48px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center text-[var(--an-muted)]">
                        <Inbox size={16} />
                      </span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-[12.5px] font-medium">
                        {request.file.fileName}
                      </p>
                      <Badge tone={STATUS_TONE[request.status]}>
                        {request.status}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-[11px] text-[var(--an-muted)]">
                      {request.file.folder.name} ·{" "}
                      {formatDate(request.createdAt)}
                    </p>

                    <div className="mt-1.5 space-y-0.5 text-[11px]">
                      {request.email ? (
                        <a
                          href={`mailto:${request.email}`}
                          className="inline-flex items-center gap-1 text-[var(--an-accent)] hover:underline"
                        >
                          {request.email}
                          <ExternalLink size={10} />
                        </a>
                      ) : (
                        <p className="text-[var(--an-muted)]">
                          No email provided
                        </p>
                      )}
                      {request.name && (
                        <p className="text-[var(--an-text-soft)]">
                          From: {request.name}
                        </p>
                      )}
                      {request.note && (
                        <p className="text-[var(--an-text-soft)]">
                          “{request.note}”
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    {request.status === "PENDING" ? (
                      <>
                        <button
                          type="button"
                          className="an-btn an-btn-primary an-btn-xs"
                          onClick={() =>
                            void setRequestStatus(request.id, "FULFILLED")
                          }
                          disabled={isWorking}
                        >
                          <CheckCircle2 size={13} />
                          Fulfilled
                        </button>
                        <button
                          type="button"
                          className="an-btn an-btn-soft an-btn-xs"
                          onClick={() =>
                            void setRequestStatus(request.id, "DISMISSED")
                          }
                          disabled={isWorking}
                        >
                          Dismiss
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="an-btn an-btn-soft an-btn-xs"
                        onClick={() =>
                          void setRequestStatus(request.id, "PENDING")
                        }
                        disabled={isWorking}
                      >
                        <RotateCcw size={13} />
                        Reopen
                      </button>
                    )}
                    <button
                      type="button"
                      className="an-icon-btn an-icon-btn-danger"
                      onClick={() => void deleteRequest(request.id)}
                      disabled={isWorking}
                      aria-label="Delete request"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
