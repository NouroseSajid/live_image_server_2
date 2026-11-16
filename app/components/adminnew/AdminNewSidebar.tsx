"use client";

import {
  ArrowUpRight,
  FolderTree,
  Images,
  Inbox,
  LayoutDashboard,
  Settings,
} from "lucide-react";
import type { AdminSection } from "./types";

const NAV_ITEMS: Array<{
  id: AdminSection;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: "overview", label: "Overview", icon: <LayoutDashboard size={16} /> },
  { id: "library", label: "Library", icon: <Images size={16} /> },
  { id: "folders", label: "Folders", icon: <FolderTree size={16} /> },
  { id: "requests", label: "Requests", icon: <Inbox size={16} /> },
  { id: "settings", label: "Settings", icon: <Settings size={16} /> },
];

export default function AdminNewSidebar({
  section,
  onSelect,
  pendingCount,
  userLabel,
}: {
  section: AdminSection;
  onSelect: (section: AdminSection) => void;
  pendingCount: number;
  userLabel: string;
}) {
  return (
    <aside className="an-sidebar">
      <div className="an-brand">
        <span className="an-brand-mark">
          <Images size={16} />
        </span>
        <div className="min-w-0">
          <p className="text-[13px] font-semibold leading-tight">Admin</p>
          <p className="truncate text-[11px] text-[var(--an-muted)]">
            Nourose Repository
          </p>
        </div>
      </div>

      <nav className="an-nav" aria-label="Admin sections">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="an-nav-item"
            data-active={section === item.id}
            onClick={() => onSelect(item.id)}
          >
            <span className="an-nav-icon">{item.icon}</span>
            <span>{item.label}</span>
            {item.id === "requests" && pendingCount > 0 && (
              <span className="an-badge an-badge-neutral ml-auto">
                {pendingCount > 99 ? "99+" : pendingCount}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="an-panel-soft p-3">
        <p className="text-[11px] text-[var(--an-muted)]">Signed in as</p>
        <p className="mt-0.5 truncate text-[12px] font-medium">{userLabel}</p>
        <a
          href="/"
          className="mt-2 inline-flex items-center gap-1 text-[12px] text-[var(--an-accent)] hover:underline"
        >
          View site
          <ArrowUpRight size={12} />
        </a>
      </div>
    </aside>
  );
}
