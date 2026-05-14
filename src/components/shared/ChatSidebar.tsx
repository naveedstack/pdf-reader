"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase/config";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FileText, Loader2, MessageSquare } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DocumentRecord {
  id: string;
  fileName: string;
  status: "PENDING" | "PROCESSING" | "READY" | "FAILED";
}

export default function ChatSidebar() {
  const { user } = useAuth();
  const { documentId } = useParams();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const docsRef = collection(db, `workspaces/${user.uid}/documents`);
    const q = query(docsRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedDocs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as DocumentRecord[];

      setDocuments(fetchedDocs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  if (loading) {
    return (
      <div className="hidden md:flex w-72 flex-col border-r bg-white h-full justify-center items-center text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm mt-2 font-medium">Loading documents...</p>
      </div>
    );
  }

  return (
    <div className="hidden md:flex w-72 flex-col border-r bg-slate-50/50 h-full shrink-0">
      <div className="p-4 border-b bg-white">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          Conversations
        </h2>
      </div>

      <ScrollArea className="flex-1 px-3 py-4">
        <div className="space-y-1">
          {documents.map((doc) => {
            const isActive = doc.id === documentId;
            const isReady = doc.status === "READY";

            return (
              <Link
                key={doc.id}
                href={isReady ? `/chat/${doc.id}` : "#"}
                className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                  isActive
                    ? "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20"
                    : isReady
                    ? "hover:bg-white hover:shadow-sm text-slate-600 hover:text-slate-900"
                    : "opacity-50 cursor-not-allowed text-slate-500"
                }`}
              >
                <FileText className={`h-4 w-4 shrink-0 ${isActive ? "text-primary" : "text-slate-400"}`} />
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium truncate">{doc.fileName}</span>
                  {!isReady && (
                    <span className="text-xs text-amber-600 font-medium tracking-tight">
                      Processing...
                    </span>
                  )}
                </div>
              </Link>
            );
          })}

          {documents.length === 0 && (
            <div className="text-center p-4 text-slate-500 text-sm mt-10">
              <FileText className="h-8 w-8 mx-auto text-slate-300 mb-2" />
              No documents found.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
