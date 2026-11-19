import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/lib/auth";
import AdminNewApp from "@/app/components/adminnew/AdminNewApp";

// Canonical admin panel. The previous panel lives at /adminold.
export default async function AdminPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-6">
        <div className="max-w-sm text-center">
          <h1 className="text-lg font-semibold">Not authorized</h1>
          <p className="mt-1 text-[13px] text-[var(--an-muted)]">
            Sign in with an admin account to open this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AdminNewApp
      userLabel={session.user.name ?? session.user.email ?? "Admin"}
    />
  );
}
