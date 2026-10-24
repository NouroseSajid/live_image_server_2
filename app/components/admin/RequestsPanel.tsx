"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { FiExternalLink, FiRefreshCw, FiTrash2 } from "react-icons/fi";
import { getPreviewFromVariants } from "./fileUtils";
import type { ImageRequestEntry } from "./types";

type StatusFilter = "PENDING" | "FULFILLED" | "DISMISSED" | "ALL";
type RequestStatus = ImageRequestEntry["status"];

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

function StatusBadge({ status }: { status: RequestStatus }) {
  const styles: Record<RequestStatus, string> = {
    PENDING:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    FULFILLED:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    DISMISSED: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  };

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${styles[status]}`}
    >
      {status}
    </span>
  );
}

export default function RequestsPanel() {
  const [status, setStatus] = useState<StatusFilter>("PENDING");
  const [requests, setRequests] = useState<ImageRequestEntry[]>([]);
  const [counts, setCounts] = useState({
    PENDING: 0,
    FULFILLED: 0,
    DISMISSED: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);

      try {
        const response = await fetch(`/api/image-requests?status=${status}`);
        if (!response.ok) throw new Error("Failed to load requests");

        const data = (await response.json()) as {
          requests?: ImageRequestEntry[];
          counts?: {
            PENDING?: number;
            FULFILLED?: number;
            DISMISSED?: number;
          };
        };

        setRequests(Array.isArray(data.requests) ? data.requests : []);
        setCounts({
          PENDING: data.counts?.PENDING ?? 0,
          FULFILLED: data.counts?.FULFILLED ?? 0,
          DISMISSED: data.counts?.DISMISSED ?? 0,
        });
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load requests",
        );
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [status],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const source = new EventSource("/api/events");

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as { type?: string };
        if (data.type === "raw-request") void load(true);
      } catch {
        // Ignore malformed events.
      }
    };

    source.addEventListener("message", handleMessage);
    return () => {
      source.removeEventListener("message", handleMessage);
      source.close();
    };
  }, [load]);

  const setRequestStatus = async (id: string, next: RequestStatus) => {
    setWorkingId(id);
    try {
      const response = await fetch(`/api/image-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });

      if (!response.ok) throw new Error("Failed to update request");
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update request");
    } finally {
      setWorkingId(null);
    }
  };

  const deleteRequest = async (id: string) => {
    if (!window.confirm("Delete this request? This cannot be undone.")) return;

    setWorkingId(id);
    try {
      const response = await fetch(`/api/image-requests/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete request");
      await load(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete request");
    } finally {
      setWorkingId(null);
    }
  };

  const tabs: Array<{
    value: StatusFilter;
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6 dark:from-gray-900 dark:to-gray-800 sm:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              RAW requests
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Visitors asking for the original file.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          >
            <FiRefreshCw size={13} />
            Refresh
          </button>
        </div>

        <div className="mb-4 flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-700">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setStatus(tab.value)}
              className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                status === tab.value
                  ? "border-blue-600 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
              }`}
            >
              {tab.label}
              <span className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
            Loading requests…
          </div>
        ) : requests.length === 0 ? (
          <div className="rounded-xl bg-white p-10 text-center text-sm text-gray-500 shadow dark:bg-gray-800 dark:text-gray-400">
            {status === "PENDING"
              ? "No pending requests."
              : "Nothing here yet."}
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => {
              const preview = getPreviewFromVariants(request.file.variants);
              const isWorking = workingId === request.id;

              return (
                <div
                  key={request.id}
                  className="flex flex-col gap-4 rounded-xl bg-white p-4 shadow dark:bg-gray-800 sm:flex-row sm:items-start"
                >
                  <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-900">
                    {preview ? (
                      <Image
                        src={preview}
                        alt={request.file.fileName}
                        fill
                        unoptimized
                        className="object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[10px] text-gray-400">
                        No preview
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                        {request.file.fileName}
                      </p>
                      <StatusBadge status={request.status} />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {request.file.folder.name}
                    </p>

                    <div className="mt-2 space-y-0.5 text-xs">
                      {request.email ? (
                        <a
                          href={`mailto:${request.email}`}
                          className="inline-flex items-center gap-1 text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {request.email}
                          <FiExternalLink size={10} />
                        </a>
                      ) : (
                        <p className="text-gray-400 dark:text-gray-500">
                          No email provided
                        </p>
                      )}
                      {request.name && (
                        <p className="text-gray-600 dark:text-gray-300">
                          From: {request.name}
                        </p>
                      )}
                      {request.note && (
                        <p className="text-gray-600 dark:text-gray-300">
                          “{request.note}”
                        </p>
                      )}
                      <p className="text-gray-400 dark:text-gray-500">
                        {formatDate(request.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                    {request.status === "PENDING" ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            void setRequestStatus(request.id, "FULFILLED")
                          }
                          disabled={isWorking}
                          className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                        >
                          Mark fulfilled
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void setRequestStatus(request.id, "DISMISSED")
                          }
                          disabled={isWorking}
                          className="rounded bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200"
                        >
                          Dismiss
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          void setRequestStatus(request.id, "PENDING")
                        }
                        disabled={isWorking}
                        className="rounded bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 disabled:opacity-50 dark:bg-gray-700 dark:text-gray-200"
                      >
                        Reopen
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void deleteRequest(request.id)}
                      disabled={isWorking}
                      aria-label="Delete request"
                      className="rounded p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-900/20"
                    >
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
