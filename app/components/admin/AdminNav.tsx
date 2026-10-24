"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const links = [
  { href: "/admin", label: "Content" },
  { href: "/admin/folders", label: "Folders" },
  { href: "/admin/requests", label: "Requests" },
];

export default function AdminNav() {
  const pathname = usePathname();
  const [pending, setPending] = useState(0);

  const refreshPending = useCallback(async () => {
    try {
      const response = await fetch(
        "/api/image-requests?status=PENDING&limit=1",
      );
      if (!response.ok) return;

      const data = (await response.json()) as {
        counts?: { PENDING?: number };
      };
      setPending(data.counts?.PENDING ?? 0);
    } catch {
      // The badge is decorative; a failed fetch should not break the page.
    }
  }, []);

  useEffect(() => {
    // pathname is the trigger: refresh the badge after every admin navigation.
    if (!pathname) return;
    void refreshPending();
  }, [refreshPending, pathname]);

  useEffect(() => {
    const source = new EventSource("/api/events");

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data) as { type?: string };
        if (data.type === "raw-request") void refreshPending();
      } catch {
        // Ignore malformed events.
      }
    };

    source.addEventListener("message", handleMessage);
    return () => {
      source.removeEventListener("message", handleMessage);
      source.close();
    };
  }, [refreshPending]);

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <nav className="sticky top-0 z-40 border-b border-gray-200 bg-white/80 backdrop-blur dark:border-gray-800 dark:bg-gray-900/80">
      <div className="mx-auto flex max-w-7xl items-center gap-1 px-4 sm:px-6">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
              isActive(link.href)
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
            }`}
          >
            {link.label}
            {link.href === "/admin/requests" && pending > 0 && (
              <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                {pending > 99 ? "99+" : pending}
              </span>
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}
