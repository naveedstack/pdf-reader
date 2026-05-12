"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase/config";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PdfUploader } from "@/components/docs/PdfUploader";
import { Plus, FileText, Loader2, MessageSquare } from "lucide-react";
import Link from "next/link";

// Define the shape of our Firestore document
interface DocumentRecord {
  id: string;
  fileName: string;
  sizeBytes: number;
  status: "PENDING" | "PROCESSING" | "READY" | "FAILED";
  createdAt: any;
}

export default function DocumentsPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploader, setShowUploader] = useState(false);

  // Real-time Firestore Listener
  useEffect(() => {
    if (!user) return;

    // Target the specific user's workspace
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

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, [user]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header section */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Your Documents</h1>
          <p className="text-slate-500 mt-1">
            Manage your PDFs and start chatting with them.
          </p>
        </div>
        <Button onClick={() => setShowUploader(!showUploader)} variant={showUploader ? "outline" : "default"}>
          {showUploader ? "Cancel Upload" : <><Plus className="mr-2 h-4 w-4" /> Upload Document</>}
        </Button>
      </div>

      {/* Uploader Section */}
      {showUploader && (
        <div className="mb-8 animate-in fade-in slide-in-from-top-4">
          <PdfUploader onUploadComplete={() => setShowUploader(false)} />
        </div>
      )}

      {/* Document List Section */}
      <Card className="shadow-sm border border-slate-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center items-center py-20 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="bg-primary/10 p-4 rounded-full mb-4">
                <FileText className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No documents yet</h3>
              <p className="text-slate-500 max-w-sm mb-6">
                Upload your first PDF to start extracting insights and chatting with your data.
              </p>
              {!showUploader && (
                <Button variant="outline" onClick={() => setShowUploader(true)}>
                  Upload your first file
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y">
              <div className="grid grid-cols-12 gap-4 p-4 font-medium text-slate-500 text-sm bg-slate-50 rounded-t-lg">
                <div className="col-span-6">File Name</div>
                <div className="col-span-2">Size</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2 text-right">Action</div>
              </div>
              
              {documents.map((doc) => (
                <div key={doc.id} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-slate-50 transition-colors">
                  <div className="col-span-6 flex items-center gap-3 font-medium text-slate-900 truncate">
                    <FileText className="h-5 w-5 text-blue-500 shrink-0" />
                    <span className="truncate">{doc.fileName}</span>
                  </div>
                  <div className="col-span-2 text-sm text-slate-500">
                    {formatBytes(doc.sizeBytes)}
                  </div>
                  <div className="col-span-2">
                    <StatusBadge status={doc.status} />
                  </div>
                  <div className="col-span-2 text-right">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      asChild
                      disabled={doc.status !== "READY"}
                    >
                      {/* This link will eventually route to the specific chat session for this doc */}
                      <Link href={`/chat/${doc.id}`} className="flex items-center text-primary">
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Chat
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Helper component for colored status badges
function StatusBadge({ status }: { status: DocumentRecord["status"] }) {
  const styles = {
    PENDING: "bg-slate-100 text-slate-700 border-slate-200",
    PROCESSING: "bg-blue-100 text-blue-700 border-blue-200 animate-pulse",
    READY: "bg-green-100 text-green-700 border-green-200",
    FAILED: "bg-red-100 text-red-700 border-red-200",
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[status]}`}>
      {status}
    </span>
  );
}