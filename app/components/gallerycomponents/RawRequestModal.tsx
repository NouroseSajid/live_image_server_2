"use client";

import { useEffect, useRef, useState } from "react";
import { FiCheck, FiMail, FiX } from "react-icons/fi";
import { getVisitorId } from "../../lib/viewTracking";

interface RawRequestModalProps {
  isOpen: boolean;
  fileId: string;
  fileName: string;
  folderName: string;
  passphrase?: string;
  onClose: () => void;
}

const CONTACT_KEY = "rawRequestContact";

export default function RawRequestModal({
  isOpen,
  fileId,
  fileName,
  folderName,
  passphrase,
  onClose,
}: RawRequestModalProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{
    duplicate: boolean;
    email: string;
  } | null>(null);

  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setSent(null);
    setNote("");
    setSubmitting(false);

    try {
      const raw = window.localStorage.getItem(CONTACT_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { email?: unknown; name?: unknown };
        setEmail(typeof saved.email === "string" ? saved.email : "");
        setName(typeof saved.name === "string" ? saved.name : "");
      } else {
        setEmail("");
        setName("");
      }
    } catch {
      setEmail("");
      setName("");
    }

    setRemember(true);
    const timer = window.setTimeout(() => emailRef.current?.focus(), 60);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const root = document.getElementById("raw-request-dialog");
      if (!root) return;

      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, submitting, onClose]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/image-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId,
          email: email.trim(),
          name: name.trim(),
          note: note.trim(),
          visitorId: getVisitorId(),
          passphrase,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        error?: unknown;
        duplicate?: unknown;
      };

      if (!response.ok) {
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Could not send the request.",
        );
      }

      const trimmedEmail = email.trim();

      try {
        if (remember && trimmedEmail) {
          window.localStorage.setItem(
            CONTACT_KEY,
            JSON.stringify({ email: trimmedEmail, name: name.trim() }),
          );
        } else if (!remember) {
          window.localStorage.removeItem(CONTACT_KEY);
        }
      } catch {
        // Remembering the contact is a convenience, not a requirement.
      }

      setSent({ duplicate: Boolean(data.duplicate), email: trimmedEmail });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not send the request.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close request dialog"
        onClick={onClose}
        disabled={submitting}
        className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      />
      <div
        id="raw-request-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="raw-request-title"
        className="relative w-full max-w-md max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-[var(--foreground)]/10 bg-[var(--background)] p-6 shadow-2xl animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--foreground)]/[0.06]">
              <FiMail size={17} className="text-[var(--foreground)]/70" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground)]/40">
                Original file
              </p>
              <h2
                id="raw-request-title"
                className="truncate text-base font-semibold leading-tight text-[var(--foreground)]"
              >
                Request RAW
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
            className="-mr-2 -mt-1 rounded-full p-2 text-[var(--foreground)]/40 transition-colors hover:bg-[var(--foreground)]/5 hover:text-[var(--foreground)] disabled:opacity-40"
          >
            <FiX size={18} />
          </button>
        </div>

        <p className="mt-5 truncate text-[13px] font-medium text-[var(--foreground)]">
          {fileName}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-[var(--foreground)]/45">
          {folderName}
        </p>

        {sent ? (
          <div className="mt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <FiCheck size={20} />
            </div>
            <p className="mt-4 text-sm leading-relaxed text-[var(--foreground)]/70">
              {sent.duplicate
                ? "You already requested this file."
                : sent.email
                  ? `Request sent. We'll email you at ${sent.email} when the original is ready.`
                  : "Request sent. It's in the queue."}
            </p>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-[var(--foreground)] px-5 py-2.5 text-sm font-semibold text-[var(--background)] transition-all hover:opacity-90 active:scale-[0.98]"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="raw-request-email"
                className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground)]/40"
              >
                Email{" "}
                <span className="normal-case tracking-normal">(optional)</span>
              </label>
              <input
                ref={emailRef}
                id="raw-request-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                className="mt-1.5 w-full rounded-xl border border-[var(--foreground)]/15 bg-[var(--foreground)]/[0.03] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground)]/35 transition-colors focus:border-[var(--foreground)]/30 focus:outline-none focus:ring-2 focus:ring-[var(--foreground)]/10"
              />
              <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--foreground)]/45">
                Add it if you want to be notified when it&apos;s ready.
              </p>
            </div>

            <div>
              <label
                htmlFor="raw-request-name"
                className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground)]/40"
              >
                Name{" "}
                <span className="normal-case tracking-normal">(optional)</span>
              </label>
              <input
                id="raw-request-name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                placeholder="Your name"
                maxLength={120}
                className="mt-1.5 w-full rounded-xl border border-[var(--foreground)]/15 bg-[var(--foreground)]/[0.03] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground)]/35 transition-colors focus:border-[var(--foreground)]/30 focus:outline-none focus:ring-2 focus:ring-[var(--foreground)]/10"
              />
            </div>

            <div>
              <label
                htmlFor="raw-request-note"
                className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground)]/40"
              >
                Note{" "}
                <span className="normal-case tracking-normal">(optional)</span>
              </label>
              <textarea
                id="raw-request-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Anything the admin should know?"
                className="mt-1.5 w-full resize-none rounded-xl border border-[var(--foreground)]/15 bg-[var(--foreground)]/[0.03] px-4 py-2.5 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground)]/35 transition-colors focus:border-[var(--foreground)]/30 focus:outline-none focus:ring-2 focus:ring-[var(--foreground)]/10"
              />
            </div>

            <label className="flex items-start gap-2.5 text-[12px] leading-snug text-[var(--foreground)]/60">
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 rounded border-[var(--foreground)]/20 accent-[var(--foreground)]"
              />
              Remember my email on this device
            </label>

            {error && (
              <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--foreground)]/60 transition-colors hover:bg-[var(--foreground)]/5 hover:text-[var(--foreground)] disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-[var(--foreground)] px-5 py-2.5 text-sm font-semibold text-[var(--background)] transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? "Sending…" : "Send request"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
