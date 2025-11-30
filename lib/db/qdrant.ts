import { QdrantClient } from '@qdrant/js-client-rest';

// Note: The user provided a JWT token as QDRANT_COLLECTION_URL, which is likely the API Key.
// We still need the Qdrant Cluster URL.
const url = process.env.QDRANT_URL; 
const apiKey = process.env.QDRANT_API_KEY;

if (!url) {
  console.warn('QDRANT_URL is not defined');
}

if (!apiKey) {
  console.warn('QDRANT_API_KEY is not defined');
}

export const qdrantClient = new QdrantClient({
  url,
  apiKey,
});
