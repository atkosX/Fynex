import amqp from 'amqplib';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';

let connection: amqp.Connection | null = null;
let channel: amqp.Channel | null = null;

export async function getRabbitMQChannel() {
  if (channel) return channel;

  try {
    connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    
    // Assert queues
    await channel.assertQueue('scraping_queue', { durable: true });
    
    console.log('Connected to RabbitMQ');
    return channel;
  } catch (error) {
    console.error('Failed to connect to RabbitMQ:', error);
    throw error;
  }
}

export async function enqueueScrapingTask(task: { requestId: string; urls: string[] }) {
  const ch = await getRabbitMQChannel();
  ch.sendToQueue('scraping_queue', Buffer.from(JSON.stringify(task)), { persistent: true });
  console.log(`Enqueued task for request ${task.requestId}`);
}
