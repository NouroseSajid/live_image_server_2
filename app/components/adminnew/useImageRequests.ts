"use client";

import { useCallback, useEffect, useState } from "react";
import type { ImageRequestEntry } from "@/app/components/admin/types";

export type RequestStatusFilter =
  | "PENDING"
  | "FULFILLED"
  | "DISMISSED"
  | "ALL";

export interface RequestCounts {
  PENDING: number;
  FULFILLED: number;
  DISMISSED: number;
}

export default function useImageRequests(status: RequestStatusFilter) {
  const [requests, setRequests] = useState<ImageRequestEntry[]>([]);
  const [counts, setCounts] = useState<RequestCounts>({
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
          counts?: Partial<RequestCounts>;
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

  const setRequestStatus = async (
    id: string,
    next: ImageRequestEntry["status"],
  ) => {
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

  return {
    requests,
    counts,
    loading,
    error,
    workingId,
    reload: load,
    setRequestStatus,
    deleteRequest,
  };
}
