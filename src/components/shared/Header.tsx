"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { FileText, LogOut, LayoutDashboard, MessageSquare } from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { usePathname, useRouter } from "next/navigation";

export default function Header() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut(auth);
    router.push("/");
  };

  return (
    <header className="px-6 py-4 flex items-center justify-between border-b bg-white shrink-0 h-16 sticky top-0 z-50">
      <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight transition-transform hover:scale-[1.02]">
        <div className="bg-primary p-1.5 rounded-lg shadow-sm">
          <FileText className="text-white h-5 w-5" />
        </div>
        <span className="bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">DocuMind AI</span>
      </Link>
      
      {!loading && (
        <div className="flex items-center gap-4 animate-in fade-in duration-300">
          {user ? (
            <>
              {pathname !== "/chat" && (
                <Button asChild variant="outline" className="hidden sm:flex" size="sm">
                  <Link href="/chat">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Workspace Chat
                  </Link>
                </Button>
              )}
              {pathname !== "/documents" && (
                <Button asChild variant="outline" className="hidden sm:flex" size="sm">
                  <Link href="/documents">
                    <LayoutDashboard className="h-4 w-4 mr-2" />
                    Dashboard
                  </Link>
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-slate-600 hover:text-red-600 hover:bg-red-50">
                <LogOut className="h-4 w-4 sm:mr-2" /> 
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </>
          ) : (
            <>
              {pathname !== "/login" && (
                <Button asChild variant="ghost" size="sm">
                  <Link href="/login">Login</Link>
                </Button>
              )}
              {pathname !== "/signup" && (
                <Button asChild size="sm" className="shadow-sm">
                  <Link href="/signup">Get Started</Link>
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </header>
  );
}
