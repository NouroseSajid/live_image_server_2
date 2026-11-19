"use client";

import { CheckCircle2, UploadCloud, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import type { Folder } from "@/app/components/admin/types";

/**
 * Global ingest target selector. The watcher reads this from ingest-config.json
 * via /api/ingest-config and switches folders within ~5 seconds of a save.
 */
export default function IngestTargetPanel({ folders }: { folders: Folder[] }) {
  const [ingestFolderId, setIngestFolderId] = useState("");
  const [savedIngestFolderId, setSavedIngestFolderId] = useState<string | null>(
    null,
  );
  const [ingestLoading, setIngestLoading] = useState(true);
  const [ingestSaving, setIngestSaving] = useState(false);
  const [ingestMessage, setIngestMessage] = useState<{
    kind: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/ingest-config")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const id = typeof data?.folderId === "string" ? data.folderId : "";
        setIngestFolderId(id);
        setSavedIngestFolderId(id || null);
      })
      .catch(() => {
        if (!cancelled) {
          setIngestMessage({
            kind: "error",
            text: "Could not load the current ingest target.",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setIngestLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const saveIngestTarget = async () => {
    if (!ingestFolderId) {
      setIngestMessage({ kind: "error", text: "Choose a folder first." });
      return;
    }

    setIngestSaving(true);
    setIngestMessage(null);
    try {
      const res = await fetch("/api/ingest-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId: ingestFolderId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to save the ingest target");
      }
      setSavedIngestFolderId(ingestFolderId);
      setIngestMessage({ kind: "success", text: "Ingest target saved." });
    } catch (err) {
      setIngestMessage({
        kind: "error",
        text:
          err instanceof Error
            ? err.message
            : "Failed to save the ingest target",
      });
    } finally {
      setIngestSaving(false);
    }
  };

  const savedIngestFolder = folders.find(
    (folder) => folder.id === savedIngestFolderId,
  );
  const ingestDirty = ingestFolderId !== (savedIngestFolderId ?? "");

  return (
    <section className="an-panel overflow-hidden">
      <div className="an-panel-head items-center">
        <div>
          <h2 className="text-[13px] font-semibold">Ingest target</h2>
          <p className="mt-0.5 text-[11px] text-[var(--an-muted)]">
            Where files dropped into the ingest watcher are filed.
          </p>
        </div>
        {savedIngestFolder && (
          <span className="an-badge an-badge-neutral">
            {savedIngestFolder.name}
          </span>
        )}
      </div>

      <div className="an-panel-body space-y-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1">
            <label className="an-label" htmlFor="an-ingest-target">
              Folder
            </label>
            <select
              id="an-ingest-target"
              value={ingestFolderId}
              onChange={(event) => {
                setIngestFolderId(event.target.value);
                setIngestMessage(null);
              }}
              disabled={ingestLoading || ingestSaving}
              className="mt-1.5 w-full rounded-md border border-[var(--an-border)] bg-[var(--an-surface)] px-2.5 py-2 text-[12px] text-[var(--an-text)] outline-none focus:border-[var(--an-accent)]"
            >
              <option value="">Select folder…</option>
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="an-btn an-btn-primary"
            onClick={() => void saveIngestTarget()}
            disabled={ingestLoading || ingestSaving || !ingestFolderId}
          >
            <UploadCloud size={14} />
            {ingestSaving ? "Saving…" : "Save ingest target"}
          </button>
        </div>

        {ingestMessage && (
          <p
            className={`flex items-center gap-1.5 text-[11px] ${
              ingestMessage.kind === "success"
                ? "text-[var(--an-success)]"
                : "text-[var(--an-danger)]"
            }`}
          >
            {ingestMessage.kind === "success" ? (
              <CheckCircle2 size={13} />
            ) : (
              <XCircle size={13} />
            )}
            {ingestMessage.text}
          </p>
        )}

        {ingestDirty && (
          <p className="text-[11px] text-[var(--an-warning)]">
            You have unsaved changes.
          </p>
        )}
      </div>
    </section>
  );
}
