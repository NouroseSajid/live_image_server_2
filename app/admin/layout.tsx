import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin — Nourose Repository",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="adminnew flex-1">{children}</div>;
}
