"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase/config";
import { collection, query, orderBy, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PdfUploader } from "@/components/docs/PdfUploader";
import { Plus, FileText, Loader2, MessageSquare, Trash2, Search, Calendar, HardDrive } from "lucide-react";
import Link from "next/link";

// Define the shape of our Firestore document
interface DocumentRecord {
  id: string;
  fileName: string;
  sizeBytes: number;
  status: "PENDING" | "PROCESSING" | "READY" | "FAILED";
  createdAt: any;
  storageUrl?: string;
}

export default function DocumentsPage() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploader, setShowUploader] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const handleDelete = async (docObj: DocumentRecord) => {
    if (!user) return;
    
    // Ask for confirmation
    const confirmed = window.confirm(`Are you sure you want to delete "${docObj.fileName}"? This action cannot be undone.`);
    if (!confirmed) return;

    setDeletingId(docObj.id);

    try {
      // 1. Delete from UploadThing and Pinecone via our new API
      const response = await fetch("/api/documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId: docObj.id,
          workspaceId: user.uid,
          storageUrl: docObj.storageUrl
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete remote resources.");
      }

      // 2. Delete from Firestore
      await deleteDoc(doc(db, `workspaces/${user.uid}/documents/${docObj.id}`));

    } catch (error) {
      console.error("Deletion failed:", error);
      alert("Failed to delete document. Please try again.");
    } finally {
      setDeletingId(null);
    }
  };

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

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "Unknown date";
    // Firestore timestamp or JS Date
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    }).format(date);
  };

  const filteredDocs = useMemo(() => {
    if (!searchQuery.trim()) return documents;
    return documents.filter(doc => 
      doc.fileName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [documents, searchQuery]);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-br from-slate-900 to-slate-500 bg-clip-text text-transparent">
            Your Documents
          </h1>
          <p className="text-slate-500 mt-2 text-lg">
            Manage your PDFs and start chatting with your data.
          </p>
        </div>
        <Button 
          onClick={() => setShowUploader(true)} 
          className="shadow-sm transition-all hover:shadow-md h-11 px-6 rounded-full"
        >
          <Plus className="mr-2 h-5 w-5" /> Upload Document
        </Button>
      </div>

      {/* Uploader Modal */}
      <Dialog open={showUploader} onOpenChange={setShowUploader}>
        <DialogContent className="sm:max-w-[600px] border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold bg-gradient-to-br from-slate-900 to-slate-500 bg-clip-text text-transparent">
              Upload Document
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <PdfUploader onUploadComplete={() => setShowUploader(false)} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Content Section */}
      {loading ? (
        <div className="flex flex-col justify-center items-center py-32 text-slate-400 space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
          <p className="text-sm font-medium animate-pulse">Loading documents...</p>
        </div>
      ) : documents.length === 0 ? (
        <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50 shadow-none">
          <CardContent className="flex flex-col items-center justify-center py-28 text-center">
            <div className="bg-white p-6 rounded-full shadow-sm mb-6 border border-slate-100 relative group cursor-pointer hover:scale-105 transition-transform" onClick={() => setShowUploader(true)}>
              <FileText className="h-12 w-12 text-blue-500 group-hover:text-blue-600 transition-colors" />
              <div className="absolute -top-2 -right-2 bg-blue-100 rounded-full p-1 border border-white">
                <Plus className="h-4 w-4 text-blue-600" />
              </div>
            </div>
            <h3 className="text-2xl font-semibold mb-2 text-slate-800">No documents yet</h3>
            <p className="text-slate-500 max-w-md mb-8 text-lg">
              Upload your first PDF to extract insights and chat with your data instantly.
            </p>
            <Button size="lg" onClick={() => setShowUploader(true)} className="shadow-md hover:shadow-lg transition-all rounded-full px-8">
              <Plus className="mr-2 h-5 w-5" /> Upload your first file
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <div className="relative w-full flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search documents by name..." 
                className="pl-10 bg-white border-none shadow-sm focus-visible:ring-1 focus-visible:ring-blue-500 rounded-lg h-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="text-sm text-slate-500 font-medium bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-100 flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              <span>{filteredDocs.length} {filteredDocs.length === 1 ? 'document' : 'documents'}</span>
            </div>
          </div>

          {/* Grid Layout */}
          {filteredDocs.length === 0 ? (
            <div className="py-24 text-center flex flex-col items-center">
              <Search className="h-12 w-12 text-slate-300 mb-4" />
              <p className="text-lg text-slate-500 font-medium">No documents match your search</p>
              <Button variant="link" onClick={() => setSearchQuery("")} className="mt-2 text-blue-500">
                Clear search
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDocs.map((docObj) => (
                <Card 
                  key={docObj.id} 
                  className="group flex flex-col overflow-hidden border-slate-200 hover:border-blue-200 hover:shadow-xl transition-all duration-300 hover:-translate-y-1 bg-white"
                >
                  <CardHeader className="p-5 pb-3">
                    <div className="flex justify-between items-start gap-4 mb-2">
                      <div className="p-3 bg-blue-50/80 text-blue-600 rounded-xl group-hover:scale-110 group-hover:bg-blue-100 transition-all duration-300">
                        <FileText className="h-6 w-6" />
                      </div>
                      <StatusBadge status={docObj.status} />
                    </div>
                    <CardTitle className="text-[17px] font-semibold leading-tight text-slate-800 line-clamp-2" title={docObj.fileName}>
                      {docObj.fileName}
                    </CardTitle>
                  </CardHeader>
                  
                  <CardContent className="p-5 pt-0 flex-grow">
                    <div className="flex flex-col gap-2.5 text-sm text-slate-500 mt-2">
                      <div className="flex items-center gap-2.5 bg-slate-50 px-3 py-1.5 rounded-md">
                        <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                        <span className="font-medium text-slate-600">{formatDate(docObj.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-2.5 bg-slate-50 px-3 py-1.5 rounded-md">
                        <HardDrive className="h-4 w-4 text-slate-400 shrink-0" />
                        <span className="font-medium text-slate-600">{formatBytes(docObj.sizeBytes)}</span>
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="p-5 pt-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
                    <Button 
                      className="flex-1 bg-slate-900 hover:bg-blue-600 text-white shadow-sm transition-colors rounded-lg h-10"
                      asChild
                      disabled={docObj.status !== "READY" || deletingId === docObj.id}
                    >
                      <Link href={`/chat/${docObj.id}`}>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Chat
                      </Link>
                    </Button>

                    <Button 
                      variant="outline"
                      size="icon"
                      className="text-red-500 border-red-100 hover:bg-red-50 hover:text-red-600 hover:border-red-200 shrink-0 rounded-lg h-10 w-10 transition-colors"
                      disabled={deletingId === docObj.id}
                      onClick={() => handleDelete(docObj)}
                      title="Delete Document"
                    >
                      {deletingId === docObj.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Helper component for colored status badges
function StatusBadge({ status }: { status: DocumentRecord["status"] }) {
  const styles = {
    PENDING: "bg-slate-100 text-slate-600 border-slate-200/60",
    PROCESSING: "bg-blue-50 text-blue-600 border-blue-200/60 ring-1 ring-blue-500/20",
    READY: "bg-emerald-50 text-emerald-600 border-emerald-200/60 ring-1 ring-emerald-500/20",
    FAILED: "bg-red-50 text-red-600 border-red-200/60 ring-1 ring-red-500/20",
  };

  const labels = {
    PENDING: "Pending",
    PROCESSING: "Processing...",
    READY: "Ready",
    FAILED: "Failed",
  };

  return (
    <span className={`px-2.5 py-1 flex items-center gap-1.5 rounded-full text-[10px] uppercase tracking-wider font-bold border shadow-sm ${styles[status]}`}>
      {status === "PROCESSING" && <Loader2 className="h-3 w-3 animate-spin shrink-0" />}
      {labels[status]}
    </span>
  );
}