/**
 * Live web search adapter (Tavily). Implements the provider-agnostic
 * SearchProvider so other search backends (Brave, Bing, SerpAPI) can slot in
 * behind the same interface. The API key is injected and never logged.
 */
import type { SearchProvider, SearchResult } from '../index.js';

export interface TavilyConfig {
  apiKey: string;
  maxResults?: number;
}

interface TavilyResponse {
  results?: { title?: string; url?: string; content?: string; published_date?: string }[];
}

export class TavilySearchProvider implements SearchProvider {
  readonly name = 'tavily';
  readonly offline = false;

  constructor(private readonly config: TavilyConfig) {}

  async search(query: string): Promise<SearchResult[]> {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: this.config.apiKey,
        query,
        max_results: this.config.maxResults ?? 5,
        search_depth: 'basic',
      }),
    });
    if (!res.ok) throw new Error(`Search provider error (${res.status})`);
    const data = (await res.json()) as TavilyResponse;
    return (data.results ?? [])
      .filter((r) => typeof r.url === 'string')
      .map((r) => ({
        title: r.title ?? r.url!,
        url: r.url!,
        snippet: r.content ?? '',
        publishedAt: r.published_date,
      }));
  }
}
