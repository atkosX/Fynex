import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

const queryModel = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",
  apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
  temperature: 0.7, 
});

export function normalizeQuery(query: string): string {
  // Remove special characters, extra spaces, and lowercase
  return query.trim().replace(/[^\w\s]/gi, '').replace(/\s+/g, ' ').toLowerCase();
}

export async function expandQuery(query: string): Promise<string[]> {
  const prompt = PromptTemplate.fromTemplate(`
    You are an expert financial researcher. Generate 3 distinct search queries based on the following topic to retrieve comprehensive financial information.
    Focus on different aspects: market sentiment, fundamental data, and recent news.
    
    Topic: {topic}
    
    Output ONLY the queries as a newline-separated list. Do not number them.
  `);

  const chain = prompt.pipe(queryModel).pipe(new StringOutputParser());
  
  try {
    const result = await chain.invoke({ topic: query });
    const variations = result.split('\n').filter(q => q.trim() !== '');
    // Return unique queries including the original
    return [...new Set([query, ...variations])];
  } catch (error) {
    console.error("Error expanding query:", error);
    return [query];
  }
}
