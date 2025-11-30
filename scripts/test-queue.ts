import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import amqp from 'amqplib';
import { v4 as uuidv4 } from 'uuid';

async function testQueue() {
  const requestId = uuidv4();
  const urls = ['https://example.com'];
  
  console.log(`Enqueuing test task for ${requestId}...`);
  
  const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://localhost');
  const channel = await connection.createChannel();
  await channel.assertQueue('scraping_queue', { durable: true });
  
  channel.sendToQueue('scraping_queue', Buffer.from(JSON.stringify({ requestId, urls })), { persistent: true });
  console.log(`Enqueued task for request ${requestId}`);
  console.log('Task enqueued. Check worker logs.');
  
  await channel.close();
  await connection.close();
  process.exit(0);
}

testQueue().catch(console.error);
