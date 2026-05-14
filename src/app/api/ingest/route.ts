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
      // --- THE PDF PARSER ---
      const pdfParseModule: any = await import("pdf-parse");
      
      if (pdfParseModule.PDFParse) {
        // pdf-parse v2.4.5+ uses a class-based API
        const parser = new pdfParseModule.PDFParse({ data: buffer });
        const textResult = await parser.getText();
        rawText = textResult.text || "";
      } else {
        // Fallback for older pdf-parse versions
        const extractText =
          typeof pdfParseModule === "function" ? pdfParseModule :
            typeof pdfParseModule.default === "function" ? pdfParseModule.default :
              typeof pdfParseModule.default?.default === "function" ? pdfParseModule.default.default :
                null;

        if (!extractText) throw new Error("Could not extract pdf-parse function.");

        const pdfData: any = await extractText(buffer);
        
        // Aggressively hunt for the text, no matter how Turbopack structured the object
        rawText = pdfData?.text || pdfData?.data?.text || pdfData?.info?.text || "";
      }

      // If it is still empty, log the object keys so we can see exactly what Turbopack returned
      if (!rawText.trim()) {
        console.error("⚠️ PDF PARSER WARNING: Object was returned, but no text found.");
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

    // Basic cleanup of common page number patterns like "-- 1 of 60 --" or "Page 1"
    const cleanedText = rawText
      .replace(/--\s*\d+\s*of\s*\d+\s*--/gi, "")
      .replace(/page\s*\d+/gi, "")
      .replace(/\d+\s*\/\s*\d+/g, "");

    const alphaCount = (cleanedText.match(/[a-zA-Z]/g) || []).length;

    if (!cleanedText.trim() || alphaCount < 50) {
      console.log("⚠️ Image-only PDF detected (low alphabetical characters). Falling back to Gemini for OCR extraction...");
      try {
        console.log("Sending PDF to Gemini 2.5 Flash via REST API for OCR...");
        
        const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("Missing Google API Key for OCR fallback.");

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: 'Extract all the text from this document. Output only the extracted text with proper formatting and no extra commentary. Do not include page numbers.' },
                { inlineData: { mimeType: 'application/pdf', data: buffer.toString('base64') } }
              ]
            }]
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Gemini API error (${response.status}): ${errorText}`);
        }

        const result = await response.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        
        rawText = text || "";
        console.log("Gemini OCR extraction complete. Extracted length:", rawText.length);
        
        if (!rawText.trim()) {
           throw new Error("Gemini OCR returned empty text.");
        }
      } catch (ocrError: any) {
        console.error("Gemini OCR Fallback failed:", ocrError);
        throw new Error("Text extraction failed. Document appears to be image-only and Gemini OCR fallback failed: " + (ocrError.message || "Unknown error"));
      }
    } else {
      // Use the cleaned text for chunking to avoid footer pollution
      rawText = cleanedText;
    }

    // 3. Chunk the Text
    const chunks: string[] = [];
    let currentChunk = "";
    const lines = rawText.split("\n");
    console.log("lines -->", lines);

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