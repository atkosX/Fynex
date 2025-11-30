import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getRabbitMQChannel } from '@/lib/queue/rabbitmq';
import { scrapeUrl } from '@/lib/scraper';
import { qdrantClient } from '@/lib/db/qdrant';
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { v4 as uuidv4 } from 'uuid';
import { ConsumeMessage } from 'amqplib';

const embeddings = new GoogleGenerativeAIEmbeddings({
  modelName: "embedding-001", // or text-embedding-004
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY,
});

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
      const embedding = await embeddings.embedQuery(doc.pageContent);
      
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
       // Ensure collection exists
       const collectionName = 'financial_docs';
       try {
         await qdrantClient.getCollection(collectionName);
       } catch {
         await qdrantClient.createCollection(collectionName, {
           vectors: { size: 768, distance: 'Cosine' }, // embedding-001 is 768 dim
         });
       }

       await qdrantClient.upsert(collectionName, {
         points,
       });
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
