import { normalizeQuery, expandQuery } from '@/lib/query-processing';
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { HumanMessage, AIMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { createAssistantStreamResponse } from 'assistant-stream';
import { SYSTEM_PROMPT } from '@/lib/prompts';
import { searchWeb } from '@/lib/search';
import { enqueueScrapingTask } from '@/lib/queue/rabbitmq';
import { qdrantClient } from '@/lib/db/qdrant';
import { v4 as uuidv4 } from 'uuid';
import { z } from "zod";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

export const maxDuration = 60; // Increase timeout for RAG

const embeddings = new GoogleGenerativeAIEmbeddings({
  modelName: "embedding-001",
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages } = body;

    console.log('Chat request body:', JSON.stringify(body, null, 2));

    const langchainMessages = messages.map((m: any) => {
      let content = "";
      if (typeof m.content === 'string') {
        content = m.content;
      } else if (Array.isArray(m.content)) {
        content = m.content.map((c: any) => c.text || "").join("");
      } else if (Array.isArray(m.parts)) {
        content = m.parts.map((p: any) => p.text || "").join("");
      }

      if (m.role === 'user') return new HumanMessage(content);
      if (m.role === 'assistant') return new AIMessage(content);
      if (m.role === 'system') return new SystemMessage(content);
      return new HumanMessage(content);
    });

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing Gemini API Key.");
    }

    const chat = new ChatGoogleGenerativeAI({
      model: "gemini-2.5-flash",
      apiKey: apiKey,
      streaming: true,
      maxOutputTokens: 2048,
    });

    const tools = [
      {
        name: "research_topic",
        description: "Search the web for a topic, extract relevant URLs, and analyze them for deep insights.",
        schema: z.object({
          query: z.string().describe("The search query to find relevant documents."),
        }),
      }
    ];

    const modelWithTools = chat.bindTools(tools);

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", SYSTEM_PROMPT],
      new MessagesPlaceholder("messages"),
    ]);

    const chain = prompt.pipe(modelWithTools);

    console.log('Streaming response from Gemini via LangChain');
    
    return createAssistantStreamResponse(async (controller) => {
      try {
        const stream = await chain.stream({
          messages: langchainMessages,
        });

        let gatheredChunks = [];
        let toolCall = null;

        for await (const chunk of stream) {
          gatheredChunks.push(chunk);
          if (chunk.tool_calls && chunk.tool_calls.length > 0) {
            toolCall = chunk.tool_calls[0];
            break; // Stop streaming if tool call
          }
          if (chunk.content) {
            const text = typeof chunk.content === 'string' ? chunk.content : JSON.stringify(chunk.content);
            controller.appendText(text);
          }
        }

        if (toolCall) {
          console.log('Tool call detected:', toolCall);
          const requestId = uuidv4();
          const rawQuery = toolCall.args.query;
          const normalizedQuery = normalizeQuery(rawQuery);
          
          console.log(`Analyzing Request: "${rawQuery}"`);
          console.log(`Query Expansion: Generating variations...`);
          
          const expandedQueries = await expandQuery(normalizedQuery);
          console.log(`Search Queries: ${expandedQueries.join(', ')}`);
          
          // 1. Search Web (Top 2 queries to avoid overload)
          const queriesToSearch = expandedQueries.slice(0, 2);
          let allSearchResults: any[] = [];
          let allUrls: string[] = [];

          for (const q of queriesToSearch) {
             console.log(`Searching web for: "${q}"...`);
             const results = await searchWeb(q);
             allSearchResults.push(...results);
             allUrls.push(...results.map(r => r.link));
          }
          
          const uniqueUrls = [...new Set(allUrls)];
          console.log(`Found ${uniqueUrls.length} unique sources. Enqueuing...`);
          
          // 2. Enqueue
          await enqueueScrapingTask({ requestId, urls: uniqueUrls });
          
          // 3. Wait for processing (Poll Qdrant)
          console.log(`Processing documents...`);
          
          let attempts = 0;
          let foundDocs = false;
          while (attempts < 30) { // Wait up to 30s
            await new Promise(r => setTimeout(r, 1000));
            try {
              const count = await qdrantClient.count('financial_docs', {
                filter: {
                  must: [{ key: 'requestId', match: { value: requestId } }]
                }
              });
              if (count.count > 0) {
                foundDocs = true;
                break;
              }
            } catch (e) {
              // Collection might not exist yet
            }
            attempts++;
          }

          if (foundDocs) {
            console.log(`Analysis complete. Synthesizing insights...`);
            
            // 4. Multi-Query RAG
            let allPoints: any[] = [];
            for (const q of expandedQueries) {
                const vector = await embeddings.embedQuery(q);
                const results = await qdrantClient.search('financial_docs', {
                  vector,
                  filter: {
                    must: [{ key: 'requestId', match: { value: requestId } }]
                  },
                  limit: 3
                });
                allPoints.push(...results);
            }

            // Deduplicate by ID
            const uniquePoints = Array.from(new Map(allPoints.map(item => [item.id, item])).values());
            // Take top 8 most relevant chunks
            const context = uniquePoints.slice(0, 8).map(r => r.payload?.content).join("\n\n");
            
            // 5. Final Response
            const ragPrompt = ChatPromptTemplate.fromMessages([
              ["system", SYSTEM_PROMPT],
              new MessagesPlaceholder("messages"),
              new ToolMessage({
                tool_call_id: toolCall.id,
                content: `Context from analysis (Multi-Query RAG):\n${context}\n\nSearch Snippets:\n${JSON.stringify(allSearchResults.slice(0, 5))}`
              })
            ]);
            
            const ragChain = ragPrompt.pipe(chat);
            const ragStream = await ragChain.stream({
              messages: [...langchainMessages, new AIMessage({ content: "", tool_calls: [toolCall] })]
            });

            for await (const chunk of ragStream) {
              if (chunk.content) {
                const text = typeof chunk.content === 'string' ? chunk.content : JSON.stringify(chunk.content);
                controller.appendText(text);
              }
            }

          } else {
            console.log(`Deep analysis timed out. Generating response based on search snippets.`);
             // Fallback to snippets
             const fallbackPrompt = ChatPromptTemplate.fromMessages([
              ["system", SYSTEM_PROMPT],
              new MessagesPlaceholder("messages"),
              new ToolMessage({
                tool_call_id: toolCall.id,
                content: `Search Snippets:\n${JSON.stringify(allSearchResults.slice(0, 5))}`
              })
            ]);
            
            const fallbackChain = fallbackPrompt.pipe(chat);
            const fallbackStream = await fallbackChain.stream({
              messages: [...langchainMessages, new AIMessage({ content: "", tool_calls: [toolCall] })]
            });

            for await (const chunk of fallbackStream) {
              if (chunk.content) {
                const text = typeof chunk.content === 'string' ? chunk.content : JSON.stringify(chunk.content);
                controller.appendText(text);
              }
            }
          }
        }

        controller.close();
      } catch (streamError) {
        console.error('Error in stream:', streamError);
        controller.close();
      }
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
