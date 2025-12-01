import * as cheerio from 'cheerio';
const pdf = require('pdf-parse');

export async function scrapeUrl(url: string): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 mins timeout

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (!response.ok) {
        console.warn(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
        return '';
    }

    const contentType = response.headers.get('content-type');
    const buffer = await response.arrayBuffer();

    if (contentType?.includes('application/pdf')) {
      const data = await pdf(Buffer.from(buffer));
      return data.text;
    } else {
      const html = Buffer.from(buffer).toString();
      const $ = cheerio.load(html);
      // Remove scripts, styles, etc.
      $('script').remove();
      $('style').remove();
      $('nav').remove();
      $('footer').remove();
      $('header').remove();
      $('iframe').remove();
      return $('body').text().replace(/\s+/g, ' ').trim();
    }
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    return '';
  }
}
