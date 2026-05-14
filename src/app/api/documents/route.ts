import { NextResponse } from "next/server";
import { UTApi } from "uploadthing/server";
import { Pinecone } from "@pinecone-database/pinecone";

const utapi = new UTApi();
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const index = pc.index(process.env.PINECONE_INDEX_NAME!);

export async function DELETE(req: Request) {
  try {
    const { documentId, workspaceId, storageUrl } = await req.json();

    if (!documentId || !workspaceId) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    console.log(`Starting deletion process for document: ${documentId}`);

    // 1. Delete from UploadThing
    if (storageUrl) {
      const fileKey = storageUrl.split('/').pop();
      if (fileKey) {
        console.log(`Deleting file from UploadThing with key: ${fileKey}`);
        await utapi.deleteFiles(fileKey);
        console.log(`Successfully deleted file from UploadThing.`);
      }
    }

    // 2. Delete vectors from Pinecone
    try {
      console.log(`Deleting vectors for document: ${documentId} from namespace: ${workspaceId}`);
      const namespace = index.namespace(String(workspaceId));
      
      // Pinecone v7 deleteMany using metadata filter
      await namespace.deleteMany({ filter: { documentId: { $eq: String(documentId) } } });
      console.log(`Successfully deleted vectors from Pinecone.`);
    } catch (e: any) {
      console.error("Pinecone deletion error:", e);
      // We don't want to fail the whole request if Pinecone fails (e.g. if vectors weren't generated yet)
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Delete API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
