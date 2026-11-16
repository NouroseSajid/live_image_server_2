import type { ReactNode } from "react";
import type { BadgeTone } from "./folderMeta";

export function SectionHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[20px] font-semibold tracking-[-0.01em]">
          {title}
        </h1>
        {description && (
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[var(--an-muted)]">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: BadgeTone;
  children: ReactNode;
}) {
  return <span className={`an-badge an-badge-${tone}`}>{children}</span>;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-3 text-[var(--an-muted)]">{icon}</div>}
      <p className="text-[13px] font-medium">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-[12px] leading-relaxed text-[var(--an-muted)]">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="an-stat">
      <p className="an-label">{label}</p>
      <p className="mt-1.5 text-[22px] font-semibold leading-none tracking-[-0.02em]">
        {value}
      </p>
      {hint && (
        <p className="mt-1.5 text-[11px] text-[var(--an-muted)]">{hint}</p>
      )}
    </div>
  );
}
