"use client";

import { useEffect, useRef, useState } from "react";
import { FiEye, FiEyeOff, FiLock, FiX } from "react-icons/fi";

interface PassphraseModalProps {
  folderName: string;
  error?: string;
  onSubmit: (passphrase: string) => void;
  onCancel: () => void;
}

export default function PassphraseModal({
  folderName,
  error,
  onSubmit,
  onCancel,
}: PassphraseModalProps) {
  const [input, setInput] = useState("");
  const [revealed, setRevealed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSubmit(input.trim());
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close passphrase prompt"
        onClick={onCancel}
        className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="passphrase-title"
        className="relative w-full max-w-sm rounded-2xl border border-[var(--foreground)]/10 bg-[var(--background)] p-6 shadow-2xl animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--foreground)]/[0.06]">
              <FiLock size={17} className="text-[var(--foreground)]/70" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--foreground)]/40">
                Protected folder
              </p>
              <h2
                id="passphrase-title"
                className="truncate text-base font-semibold leading-tight text-[var(--foreground)]"
              >
                {folderName}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="-mr-2 -mt-1 rounded-full p-2 text-[var(--foreground)]/40 transition-colors hover:bg-[var(--foreground)]/5 hover:text-[var(--foreground)]"
          >
            <FiX size={18} />
          </button>
        </div>

        <p className="mt-5 text-[13px] leading-relaxed text-[var(--foreground)]/55">
          Enter the passphrase to view the contents of this folder.
        </p>

        <form onSubmit={handleSubmit} className="mt-4">
          <label htmlFor="passphrase" className="sr-only">
            Passphrase
          </label>
          <div className="relative">
            <input
              ref={inputRef}
              id="passphrase"
              type={revealed ? "text" : "password"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="Passphrase"
              aria-invalid={Boolean(error)}
              className="w-full rounded-xl border border-[var(--foreground)]/15 bg-[var(--foreground)]/[0.03] py-3 pl-4 pr-11 text-sm text-[var(--foreground)] placeholder:text-[var(--foreground)]/35 transition-colors focus:border-[var(--foreground)]/30 focus:outline-none focus:ring-2 focus:ring-[var(--foreground)]/10"
            />
            <button
              type="button"
              onClick={() => setRevealed((prev) => !prev)}
              aria-label={revealed ? "Hide passphrase" : "Show passphrase"}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-[var(--foreground)]/40 transition-colors hover:text-[var(--foreground)]"
            >
              {revealed ? <FiEyeOff size={16} /> : <FiEye size={16} />}
            </button>
          </div>

          {error && (
            <p className="mt-2.5 text-xs text-red-500 dark:text-red-400">
              {error}
            </p>
          )}

          <div className="mt-6 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--foreground)]/60 transition-colors hover:bg-[var(--foreground)]/5 hover:text-[var(--foreground)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!input.trim()}
              className="rounded-xl bg-[var(--foreground)] px-5 py-2.5 text-sm font-semibold text-[var(--background)] transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Unlock
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
