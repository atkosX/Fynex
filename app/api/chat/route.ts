import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText, convertToCoreMessages } from 'ai';
import { createAssistantStreamResponse } from 'assistant-stream';

export const maxDuration = 30;

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages } = body;

    console.log('Chat request body:', JSON.stringify(body, null, 2));
    console.log('Chat request messages:', JSON.stringify(messages, null, 2));

    // Data stream protocol sends messages with 'content' array
    // convertToCoreMessages expects messages with 'parts' array
    // Convert the format if needed
    let coreMessages: any[] = [];
    if (messages && Array.isArray(messages) && messages.length > 0) {
      // Check if messages have 'content' (data stream format) or 'parts' (AI SDK format)
      const needsConversion = messages.some((msg: any) => msg.content && !msg.parts);
      
      if (needsConversion) {
        // Convert from data stream format (content) to AI SDK format (parts)
        const convertedMessages = messages.map((msg: any) => ({
          ...msg,
          parts: msg.content || [],
        }));
        coreMessages = convertToCoreMessages(convertedMessages);
      } else {
        // Already in the right format
        coreMessages = convertToCoreMessages(messages);
      }
    }
    console.log('Converted core messages:', JSON.stringify(coreMessages, null, 2));

    const result = streamText({
      model: google('gemini-2.5-flash-lite'),
      messages: coreMessages,
      system: "You are FinAgent, a helpful AI trading assistant. You can help users with market analysis, trading concepts, and using the Kite Connect integration. You are concise, professional, and knowledgeable about financial markets.",
      onFinish: async ({ text, finishReason, usage }) => {
        console.log('Chat response finished:', {
          text: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
          finishReason,
          usage,
        });
      },
    });

    // Use createAssistantStreamResponse for data stream protocol
    console.log('Streaming response from Gemini - using createAssistantStreamResponse');
    return createAssistantStreamResponse(async (controller) => {
      // Stream the text from AI SDK result
      for await (const textDelta of result.textStream) {
        controller.appendText(textDelta);
      }
      controller.close();
    });
  } catch (error: any) {
    console.error('Error in chat route:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
