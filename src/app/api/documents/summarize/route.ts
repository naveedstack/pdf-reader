import { NextResponse } from "next/server";
import { getPineconeIndex } from "@/lib/pinecone";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";

export async function POST(req: Request) {
  try {
    const { documentId, workspaceId } = await req.json();

    if (!documentId || !workspaceId) {
      return NextResponse.json(
        { error: "Missing documentId or workspaceId" },
        { status: 400 }
      );
    }

    const index = getPineconeIndex();
    const namespace = index.namespace(String(workspaceId));

    // Fetch the first 4 chunks of the document
    const ids = Array.from({ length: 4 }, (_, i) => `${documentId}-chunk-${i}`);
    
    let chunks: string[] = [];
    try {
      const fetchResponse = await namespace.fetch({ ids });
      if (fetchResponse && fetchResponse.records) {
        chunks = Object.values(fetchResponse.records)
          .sort((a: any, b: any) => (a.metadata?.chunkIndex ?? 0) - (b.metadata?.chunkIndex ?? 0))
          .map((record: any) => record.metadata?.text)
          .filter(Boolean);
      }
    } catch (fetchError) {
      console.error("Error fetching chunks from Pinecone:", fetchError);
    }

    if (chunks.length === 0) {
      // Fallback: Return placeholder if Pinecone is not populated yet or is empty
      return NextResponse.json({
        summary: "This document is ready, but a summary couldn't be automatically generated because the index is still updating.",
        takeaways: [
          "The document has been successfully processed.",
          "All pages have been parsed into text.",
          "You can ask any questions using the chat input below."
        ],
        suggestedQuestions: [
          "Can you summarize this document?",
          "What are the main sections or topics?",
          "What are the key points in this file?"
        ]
      });
    }

    // Call Gemini to generate a summary, key takeaways, and suggested questions
    const prompt = `
You are an expert document analyzer. Below are the introductory paragraphs of a document. 
Generate a professional, concise summary of this document (1-2 sentences), extract 3 key takeaways (bullet points), and suggest 3 highly specific questions that a user can ask about this document.

Format the output strictly as a JSON object matching this schema:
{
  "summary": "Concise summary string.",
  "takeaways": [
    "Takeaway 1",
    "Takeaway 2",
    "Takeaway 3"
  ],
  "suggestedQuestions": [
    "Question 1?",
    "Question 2?",
    "Question 3?"
  ]
}

DOCUMENT TEXT:
${chunks.join("\n\n")}
`;

    const { text } = await generateText({
      model: google("gemini-2.5-flash"),
      prompt,
    });

    // Clean up markdown code blocks if Gemini returns them
    const cleanedText = text.replace(/```json\n?|```/g, "").trim();
    const data = JSON.parse(cleanedText);
    return NextResponse.json(data);

  } catch (error: any) {
    console.error("Summarization API Error:", error);
    return NextResponse.json(
      { error: error.message || "An error occurred during summarization." },
      { status: 500 }
    );
  }
}
