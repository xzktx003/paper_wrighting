import { chatCompletion } from '../services/llmService.js';

export function registerWebsearchRoutes(fastify) {
  fastify.post('/api/websearch', async (req) => {
    const { query } = req.body || {};
    if (!query || !String(query).trim()) {
      return { ok: false, error: 'Missing query.' };
    }

    const splitPrompt = `You are a research assistant. Given a user query, split it into 3-5 parallel search queries for academic paper search on arXiv. Return ONLY a JSON array of strings, no other text.

Example input: "diffusion models"
Example output: ["diffusion models machine learning", "diffusion models deep learning", "diffusion probabilistic models", "stable diffusion AI"]`;

    let queries = [query];
    try {
      const res = await chatCompletion({
        systemPrompt: splitPrompt,
        messages: [{ role: 'user', content: query }],
      });
      const text = (res.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          queries = parsed.map(q => String(q).trim()).filter(Boolean);
        }
      }
    } catch {}

    const allResults = [];
    const seen = new Set();

    for (const q of queries.slice(0, 5)) {
      try {
        const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(q)}&start=0&max_results=3`;
        const res = await fetch(url, { headers: { 'User-Agent': 'paper-agent/1.0' } });
        if (!res.ok) continue;
        const xml = await res.text();
        const { XMLParser } = await import('fast-xml-parser');
        const parser = new XMLParser({ ignoreAttributes: false });
        const data = parser.parse(xml);
        const entries = Array.isArray(data?.feed?.entry) ? data.feed.entry : data?.feed?.entry ? [data.feed.entry] : [];
        for (const entry of entries) {
          const id = String(entry.id || '');
          const arxivId = id ? id.split('/').pop() : '';
          if (seen.has(arxivId)) continue;
          seen.add(arxivId);
          const authors = Array.isArray(entry.author) ? entry.author : [entry.author].filter(Boolean);
          allResults.push({
            title: String(entry.title || '').replace(/\s+/g, ' ').trim(),
            abstract: String(entry.summary || '').replace(/\s+/g, ' ').trim(),
            authors: authors.map(a => a?.name).filter(Boolean),
            url: id,
            arxivId,
            sourceQuery: q,
          });
        }
      } catch {}
    }

    return { ok: true, queries, results: allResults };
  });
}
