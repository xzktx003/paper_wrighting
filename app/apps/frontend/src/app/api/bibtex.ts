import { apiFetch } from './fetchClient';

const API_BASE = '/api';

export interface BibtexResult {
  label: string;
  detail: string;
  info: string;
  bibtex: string;
  doi: string;
  title: string;
  authors: string;
  year: string;
  journal: string;
}

export interface SearchResponse {
  items: BibtexResult[];
  error?: string;
}

export async function searchBibtex(query: string, rows = 10): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query, rows: String(rows) });
  return apiFetch(`${API_BASE}/bibtex/search?${params}`);
}

export async function getBibtexByDoi(doi: string): Promise<{ bibtex: string | null; error?: string }> {
  const params = new URLSearchParams({ doi });
  return apiFetch(`${API_BASE}/bibtex/bibtex?${params}`);
}
