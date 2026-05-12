import { NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import { embedMany } from "ai";
import { google } from "@ai-sdk/google";
import { db } from "@/lib/firebase/config";
import { doc, updateDoc } from "firebase/firestore";

const pdfParse = require("pdf-parse");
// Allow slightly longer execution time for PDF processing
export const maxDuration = 60;

// Initialize Pinecone
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const index = pc.index(process.env.PINECONE_INDEX_NAME!);

export async function POST(req: Request) {
  try {
    const { fileUrl, documentId, workspaceId } = await req.json();
    console.log(`Starting ingestion for document: ${documentId}`);

    // 1. Update status to PROCESSING in Firestore
    const docRef = doc(db, `workspaces/${workspaceId}/documents`, documentId);
    await updateDoc(docRef, { status: "PROCESSING" });

    // 2. Download and Parse PDF
    console.log("Downloading PDF from URL...");
    const response = await fetch(fileUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log("Extracting text...");
    const pdfData = await pdfParse(buffer);
    const rawText = pdfData.text;

    // 3. Chunk the Text
    const chunks: string[] = [];
    let currentChunk = "";
    const lines = rawText.split("\n");
    
    for (const line of lines) {
      // Group text into ~1000 character chunks
      if ((currentChunk.length + line.length) > 1000) {
        if (currentChunk.trim()) chunks.push(currentChunk.trim());
        currentChunk = line + "\n";
      } else {
        currentChunk += line + "\n";
      }
    }
    if (currentChunk.trim()) chunks.push(currentChunk.trim());

    console.log(`Created ${chunks.length} chunks. Generating embeddings...`);

    // 4. Generate Embeddings using Gemini
    const { embeddings } = await embedMany({
      model: google.textEmbeddingModel('text-embedding-004'),
      values: chunks,
    });

    // 5. Upsert to Pinecone 
    console.log("Upserting vectors to Pinecone...");
    const vectors = embeddings.map((embedding, i) => ({
      id: `${documentId}-chunk-${i}`,
      values: embedding as number[], // Tell TS this is strictly a number array
      metadata: {
        documentId: String(documentId), // Convert 'any' to a strict string
        text: chunks[i],
        chunkIndex: i,
      },
    }));

    // Use the user's ID as the namespace so data doesn't mix between users
    const namespace = index.namespace(String(workspaceId));
    
    // The 'as any' here acts as a final failsafe to bypass any lingering TS strictness
    await namespace.upsert(vectors as any);

    // 6. Mark as READY in Firestore
    console.log("Ingestion complete. Updating status to READY.");
    await updateDoc(docRef, { status: "READY" });

    return NextResponse.json({ success: true, chunksProcessed: chunks.length });

  } catch (error: any) {
    console.error("Ingestion Pipeline Error:", error);
    
    // Try to mark as FAILED in Firestore if it breaks
    try {
      const { documentId, workspaceId } = await req.json();
      if (documentId && workspaceId) {
        await updateDoc(doc(db, `workspaces/${workspaceId}/documents`, documentId), { status: "FAILED" });
      }
    } catch(e) {
      console.error("Could not update Firestore failure status");
    }
    
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}