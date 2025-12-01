import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getRabbitMQChannel } from '@/lib/queue/rabbitmq';
import { scrapeUrl } from '@/lib/scraper';
import { qdrantClient } from '@/lib/db/qdrant';
import { pipeline } from '@xenova/transformers';
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { v4 as uuidv4 } from 'uuid';
import { ConsumeMessage } from 'amqplib';

const TEXT_EMBEDDING_MODELS = [
  {
    name: "Xenova/gte-small",
    displayName: "Xenova/gte-small",
    description: "locally running embedding",
    chunkCharLength: 512,
    endpoints: [
      { type: "transformersjs" }
    ]
  }
];

// Singleton to hold the pipeline
let embeddingPipeline: any = null;

async function getEmbedding(text: string): Promise<number[]> {
  if (!embeddingPipeline) {
    embeddingPipeline = await pipeline('feature-extraction', TEXT_EMBEDDING_MODELS[0].name);
  }
  const output = await embeddingPipeline(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data) as number[];
}

async function processTask(task: { requestId: string; urls: string[] }) {
  console.log(`Processing task for ${task.requestId}`);
  
  for (const url of task.urls) {
    console.log(`Scraping ${url}...`);
    const content = await scrapeUrl(url);
    console.log(`Scraped ${content.length} chars from ${url}`);
    
    if (!content) {
        console.log(`Skipping empty content for ${url}`);
        continue;
    }

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const docs = await splitter.createDocuments([content], [{ source: url, requestId: task.requestId }]);
    
    console.log(`Embedding ${docs.length} chunks for ${url}...`);
    
    const points = [];
    for (const doc of docs) {
      const embedding = await getEmbedding(doc.pageContent);
      
      points.push({
        id: uuidv4(),
        vector: embedding,
        payload: {
          content: doc.pageContent,
          source: url,
          requestId: task.requestId,
          metadata: doc.metadata
        },
      });
    }

    if (points.length > 0) {
      try {
       // Ensure collection exists
       const collectionName = 'financial_docs';
       const VECTOR_SIZE = 384;
       try {
         const collectionInfo = await qdrantClient.getCollection(collectionName);
         // Check if vector size matches
         const currentSize = (collectionInfo.config.params.vectors as any).size || (collectionInfo.config.params.vectors as any).default?.size;
         if (currentSize !== VECTOR_SIZE) {
           console.log(`Collection ${collectionName} has wrong vector size (${currentSize}). Recreating with size ${VECTOR_SIZE}...`);
           await qdrantClient.deleteCollection(collectionName);
           await qdrantClient.createCollection(collectionName, {
             vectors: { size: VECTOR_SIZE, distance: 'Cosine' },
           });
         }
       } catch (e) {
         // Collection likely doesn't exist
         console.log(`Creating collection ${collectionName} with vector size ${VECTOR_SIZE}...`);
         await qdrantClient.createCollection(collectionName, {
           vectors: { size: VECTOR_SIZE, distance: 'Cosine' },
         });
       }

       await qdrantClient.upsert(collectionName, {
         points,
       });
       console.log(`✓ Upserted ${points.length} points to Qdrant for requestId=${task.requestId}, source=${url}`);
      } catch (error: any) {
        console.error(`❌ Failed to upsert to Qdrant for ${url}:`, error.message);
        console.error('Error details:', error);
      }
    }
  }
  console.log(`Task ${task.requestId} completed.`);
}

async function startWorker() {
  console.log('Starting scraper worker...');
  console.log('RABBITMQ_URL:', process.env.RABBITMQ_URL);
  const channel = await getRabbitMQChannel();
  
  console.log('Waiting for messages in scraping_queue...');
  
  channel.consume('scraping_queue', (msg: ConsumeMessage | null) => {
    console.log('!!! RECEIVED MESSAGE !!!');
    if (msg) {
      console.log(`Message received: ${msg.content.toString().substring(0, 100)}...`);
      
      // Process in background to avoid blocking
      (async () => {
        try {
          const task = JSON.parse(msg.content.toString());
          console.log(`Processing task for ${task.requestId} with ${task.urls.length} URLs`);
          await processTask(task);
          console.log(`Task ${task.requestId} processed successfully`);
          channel.ack(msg);
        } catch (error) {
          console.error('Error processing message:', error);
          channel.ack(msg);
        }
      })();
    }
  });
  
  console.log('Consumer registered successfully');
}

// Check if running directly
if (require.main === module) {
  startWorker().catch(console.error);
}

export { startWorker };
