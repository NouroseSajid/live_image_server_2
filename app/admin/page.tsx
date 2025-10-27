import { getServerSession } from "next-auth/next";
import { authOptions } from "../api/auth/[...nextauth]/route";

export default async function Admin() {
  const session = await getServerSession(authOptions);
  
  return (
    <div>
      <h1>Admin Panel</h1>
      <p>Welcome {session?.user?.email}</p>
    </div>
  );
}