import { NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import { embedMany } from "ai";
import { google } from "@ai-sdk/google";

export const maxDuration = 60;

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const index = pc.index(process.env.PINECONE_INDEX_NAME!);

export async function POST(req: Request) {
  try {
    const { fileUrl, documentId, workspaceId, fileName } = await req.json();
    console.log(`Starting ingestion for document: ${fileName} (${documentId})`);

    // 1. Download File
    console.log("Downloading file from URL...");
    const response = await fetch(fileUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 2. Identify Extension and Route to correct Parser
    const extension = fileName.split('.').pop()?.toLowerCase();
    let rawText = "";

    console.log(`Detected file type: .${extension}. Routing to parser...`);

    if (extension === "pdf") {
      // --- THE PDF PARSER (With Turbopack Fix) ---
      const pdfParseModule: any = await import("pdf-parse");
      const extractText =
        typeof pdfParseModule === "function" ? pdfParseModule :
          typeof pdfParseModule.default === "function" ? pdfParseModule.default :
            typeof pdfParseModule.PDFParse === "function" ? pdfParseModule.PDFParse :
              typeof pdfParseModule.default?.default === "function" ? pdfParseModule.default.default :
                null;

      if (!extractText) throw new Error("Could not extract pdf-parse function.");

      let pdfData: any;
      try {
        pdfData = await extractText(buffer);
      } catch (parseError: any) {
        if (parseError.message && parseError.message.includes("without 'new'")) {
          const instance = new (extractText as any)(buffer);
          pdfData = await instance;
        } else {
          throw parseError;
        }
      }

      // Aggressively hunt for the text, no matter how Turbopack structured the object
      rawText = pdfData?.text || pdfData?.data?.text || pdfData?.info?.text || "";

      // If it is still empty, log the object keys so we can see exactly what Turbopack returned
      if (!rawText.trim()) {
        console.error("⚠️ PDF PARSER WARNING: Object was returned, but no text found.");
        console.error("Available keys in returned object:", Object.keys(pdfData || {}));
        if (pdfData?.text === "") {
          console.error("The .text property exists, but it is completely empty. This confirms the PDF contains no readable text data (it is an image/scan).");
        }
      }

    } else if (extension === "docx" || extension === "doc") {
      // --- THE WORD DOC PARSER ---
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      rawText = result.value || "";

    } else if (extension === "pptx" || extension === "ppt") {
      // --- THE POWERPOINT PARSER ---
      const officeParser: any = await import("officeparser");

      // Use the default export if the library wrapped it, otherwise use the module directly
      const parser = officeParser.default ? officeParser.default : officeParser;
      rawText = await parser.parseOfficeAsync(buffer);

    } else {
      throw new Error(`Unsupported file type: .${extension}`);
    }

    if (!rawText.trim()) {
      throw new Error("Text extraction resulted in empty text. The file might be an image-only document.");
    }

    // 3. Chunk the Text
    const chunks: string[] = [];
    let currentChunk = "";
    const lines = rawText.split("\n");

    for (const line of lines) {
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
      model: google.embeddingModel('gemini-embedding-2'),
      values: chunks,
    })

    console.log("Embeddings generated successfully.", embeddings);

    // 5. Upsert to Pinecone 
    console.log("Upserting vectors to Pinecone...");
    const vectors = embeddings.map((embedding, i) => ({
      id: `${documentId}-chunk-${i}`,
      values: embedding as number[],
      metadata: {
        documentId: String(documentId),
        text: chunks[i],
        chunkIndex: i,
      },
    }));

    console.log(`Successfully mapped ${vectors.length} vectors.`);

    const namespace = index.namespace(String(workspaceId));

    // Pass the vectors natively. If your specific Pinecone version still 
    // complains, wrap it in an object like this: await namespace.upsert({ records: vectors });
    await namespace.upsert({ records: vectors });
    console.log("Ingestion complete!");

    return NextResponse.json({ success: true, chunksProcessed: chunks.length });

  } catch (error: any) {
    console.error("Ingestion Pipeline Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}