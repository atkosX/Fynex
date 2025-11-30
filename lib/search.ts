const SERPAPI_KEY = process.env.SERPAPI_KEY;

export async function searchWeb(query: string): Promise<{ title: string; link: string; snippet: string }[]> {
  if (!SERPAPI_KEY) {
    console.warn('SERPAPI_KEY is not defined');
    return [];
  }

  const url = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${SERPAPI_KEY}&num=5`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.organic_results) {
      return data.organic_results.map((result: any) => ({
        title: result.title,
        link: result.link,
        snippet: result.snippet,
      }));
    }
    return [];
  } catch (error) {
    console.error('Error searching web:', error);
    return [];
  }
}
