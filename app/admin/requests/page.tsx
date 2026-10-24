import { getServerSession } from "next-auth/next";
import { authOptions } from "../../api/auth/[...nextauth]/route";
import RequestsPanel from "../../components/admin/RequestsPanel";

export default async function RequestsPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl text-red-600">Not authorized</p>
      </div>
    );
  }

  return <RequestsPanel />;
}
