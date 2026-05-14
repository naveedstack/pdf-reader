import ProtectedRoute from "@/components/shared/ProtectedRoute";
import ChatSidebar from "@/components/shared/ChatSidebar";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="flex flex-1 w-full overflow-hidden">
        <ChatSidebar />
        <main className="flex-1 flex flex-col w-full relative">{children}</main>
      </div>
    </ProtectedRoute>
  );
}
