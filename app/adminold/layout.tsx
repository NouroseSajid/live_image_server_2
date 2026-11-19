import AdminNav from "../components/admin/AdminNav";
import { AuthProvider } from "../providers/AuthProvider";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <AdminNav />
      {children}
    </AuthProvider>
  );
}
