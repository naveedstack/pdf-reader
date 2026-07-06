import { Pinecone } from "@pinecone-database/pinecone";

let pcClient: Pinecone | null = null;

export function getPineconeIndex() {
  const apiKey = process.env.PINECONE_API_KEY;
  const indexName = process.env.PINECONE_INDEX_NAME;

  if (!apiKey || !indexName) {
    throw new Error(
      "Pinecone configuration is missing. Please ensure PINECONE_API_KEY and PINECONE_INDEX_NAME are set."
    );
  }

  if (!pcClient) {
    pcClient = new Pinecone({ apiKey });
  }

  return pcClient.index(indexName);
}
