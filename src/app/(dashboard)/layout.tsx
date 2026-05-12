import ProtectedRoute from "@/components/shared/ProtectedRoute";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-50">
        {/* You can add your Sidebar or Navbar here later */}
        <main>{children}</main>
      </div>
    </ProtectedRoute>
  );
}