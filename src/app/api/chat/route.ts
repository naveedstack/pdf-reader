import { google } from "@ai-sdk/google";
import { streamText, embed } from "ai"; 
import { Pinecone } from "@pinecone-database/pinecone";

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
const index = pc.index(process.env.PINECONE_INDEX_NAME!);

export async function POST(req: Request) {
  try {
    const { messages, documentId, workspaceId } = await req.json();
    
    // 1. Manually format frontend messages into safe backend messages
    const formattedMessages = messages.map((m: any) => ({
      role: m.role,
      content: typeof m.content === 'string' 
        ? m.content 
        : Array.isArray(m.parts) ? m.parts.map((p: any) => p.text).join("") : ""
    }));
    
    const lastUserMessage = formattedMessages.filter((m: any) => m.role === 'user').pop();
    const lastMessageText = lastUserMessage?.content || "";

    if (!lastMessageText) throw new Error("Could not extract text from the user's message.");

    // 2. Turn the question into a vector
    const { embedding } = await embed({
      model: google.embeddingModel('gemini-embedding-2'),
      value: lastMessageText,
    });

    // 3. Search Pinecone for the top 5 most relevant chunks
    const namespace = index.namespace(String(workspaceId));
    const queryResponse = await namespace.query({
      vector: embedding,
      filter: { documentId: { $eq: documentId } }, 
      topK: 5,
      includeMetadata: true,
    });

    // 4. Extract the text from the matches
    const contextChunks = queryResponse.matches
      .map((match) => match.metadata?.text)
      .filter(Boolean);
    
    const context = contextChunks.join("\n\n---\n\n");

    // 5. Send to Gemini 2.5 Flash with the retrieved context
    const result = await streamText({
      model: google("gemini-2.5-flash"), 
      system: `You are a helpful assistant specialized in analyzing documents. 
      Use the following pieces of retrieved context to answer the user's question. 
      If the answer is not in the context, say that you don't know based on the document, but don't make up information.
      
      CONTEXT:
      ${context}`,
      messages: formattedMessages,
    });

    console.log("context retrieved -->", context);

    // 6. Return the specific UI Data Stream expected by your frontend version
    const res = result.toUIMessageStreamResponse(); 
    return res;

  } catch (error: any) {
    console.error("Chat API Error:", error);
    
    const isQuota = error.statusCode === 429 || error.message?.toLowerCase().includes("quota") || error.message?.toLowerCase().includes("rate limit");
    const status = isQuota ? 429 : 500;
    const message = isQuota 
      ? "Google API Quota Exceeded. Please wait a minute or use a different API key." 
      : (error.message || "An unexpected error occurred.");

    // Strict JSON response so the frontend AI SDK doesn't choke on plain text
    return Response.json({ error: message }, { status });
  }
}