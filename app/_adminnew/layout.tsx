import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin — Nourose Repository",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminNewLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="adminnew flex-1">{children}</div>;
}
