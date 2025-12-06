import { getServerSession } from "next-auth/next";
import { authOptions } from "../api/auth/[...nextauth]/route";
import IngestFolderSelector from "./components/IngestFolderSelector";

export default async function Admin() {
  const session = await getServerSession(authOptions);

  return (
    <div className="container mx-auto p-4">
      <h1 className="mb-6 text-2xl font-bold">Admin Panel</h1>
      <div className="space-y-8">
        <section>
          <p className="mb-4">
            Welcome, <strong>{session?.user?.email}</strong>.
          </p>
          <p>
            Current mode:{" "}
            <span className="font-semibold">
              {process.env.WHAT_AM_I === "1" ? "Live" : "Repo"}
            </span>
          </p>
        </section>

        <section>
          <IngestFolderSelector />
        </section>
      </div>
    </div>
  );
}
