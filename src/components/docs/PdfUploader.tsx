"use client";

import React, { useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase/config";
import { doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { useUploadThing } from "@/utils/uploadthing";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { UploadCloud, File, X } from "lucide-react";

export function PdfUploader({ onUploadComplete }: { onUploadComplete?: () => void }) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const { startUpload, isUploading } = useUploadThing("pdfUploader", {
    onUploadProgress: (p) => {
      setProgress(p);
    },
    onClientUploadComplete: async (res) => {
      if (!res || !user || !file) return;

      const uploadedFile = res[0];
      const docId = crypto.randomUUID();

      try {
        console.log("File uploaded to storage! URL:", uploadedFile.ufsUrl); 
        
        const documentRef = doc(db, `workspaces/${user.uid}/documents`, docId);

        // 1. Save metadata to Firestore
        await setDoc(documentRef, {
          fileName: file.name,
          storageUrl: uploadedFile.ufsUrl, 
          sizeBytes: uploadedFile.size,
          status: "PROCESSING", 
          uploadedBy: user.uid,
          createdAt: serverTimestamp(),
        });
        
        console.log("Firestore record created. Triggering AI ingestion...");

        // Close modal immediately
        setFile(null);
        setProgress(0);
        if (onUploadComplete) onUploadComplete();

        // 2. Trigger the backend ingestion pipeline asynchronously
        fetch("/api/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileUrl: uploadedFile.ufsUrl, 
            documentId: docId,
            workspaceId: user.uid,
            fileName: file.name, // The backend needs this to know the format
          }),
        })
        .then(response => response.json())
        .then(async data => {
          // 3. Update Firestore based on backend result
          if (data.success) {
            console.log("Backend ingestion SUCCESS!");
            await updateDoc(documentRef, { status: "READY" });
          } else {
            console.error("BACKEND INGESTION ERROR:", data.error);
            await updateDoc(documentRef, { status: "FAILED" });
          }
        })
        .catch(async err => {
          console.error("PIPELINE ERROR:", err);
          await updateDoc(documentRef, { status: "FAILED" });
        });

      } catch (err: any) {
        console.error("ERROR:", err); 
        setError("An error occurred: " + err.message);
      }
    },
    onUploadError: (e) => {
      console.error("UPLOADTHING ERROR:", e);
      setError("Upload failed: " + e.message);
    },
  });

  const MAX_FILE_SIZE = 32 * 1024 * 1024; // 32MB limit

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const selected = e.target.files?.[0];
    
    if (!selected) return;

    // Expand validation to include PDF, Word, and PPT
    const validTypes = [
      "application/pdf", 
      "application/msword", // .doc
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
      "application/vnd.ms-powerpoint", // .ppt
      "application/vnd.openxmlformats-officedocument.presentationml.presentation" // .pptx
    ];

    if (!validTypes.includes(selected.type)) {
      setError("Please select a PDF, Word (.docx), or PowerPoint (.pptx) file.");
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setError("File is too large. Maximum size is 32MB.");
      return;
    }
    
    setFile(selected);
  };

  const handleUpload = async () => {
    if (!file || !user) return;
    setError(null);
    await startUpload([file]);
  };

  return (
    <div className="border-2 border-dashed rounded-xl p-8 text-center bg-slate-50 hover:bg-slate-100 transition-colors">
      <input
        type="file"
        accept=".pdf,.doc,.docx,.ppt,.pptx"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileSelect}
      />

      {!file ? (
        <div className="flex flex-col items-center">
          <div className="bg-primary/10 p-4 rounded-full mb-4 cursor-pointer" onClick={() => fileInputRef.current?.click()}>
            <UploadCloud className="h-10 w-10 text-primary" />
          </div>
          <h3 className="text-lg font-semibold">Click to upload a document</h3>
          <p className="text-sm text-slate-500 mt-1 mb-4">Supports PDF, DOCX, and PPTX (Max 32MB)</p>
          <Button onClick={() => fileInputRef.current?.click()} variant="outline">
            Browse Files
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center w-full max-w-md mx-auto">
          <div className="flex items-center w-full p-4 bg-white rounded-lg border mb-4">
            <File className="h-8 w-8 text-blue-500 mr-4 shrink-0" />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
            {!isUploading && (
              <Button variant="ghost" size="icon" onClick={() => setFile(null)}>
                <X className="h-4 w-4 text-slate-500" />
              </Button>
            )}
          </div>

          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          {isUploading ? (
            <div className="w-full space-y-2">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Uploading to Secure Storage...</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="w-full h-2" />
            </div>
          ) : (
            <Button onClick={handleUpload} className="w-full">
              Confirm Upload
            </Button>
          )}
        </div>
      )}
    </div>
  );
}