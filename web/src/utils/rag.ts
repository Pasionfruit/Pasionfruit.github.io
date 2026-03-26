import { IngestedChunk } from "../types/domain";

export function chunkText(input: string, maxLength = 700): string[] {
  const clean = input.replace(/\s+/g, " ").trim();
  if (!clean) {
    return [];
  }

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(start + maxLength, clean.length);
    chunks.push(clean.slice(start, end));
    start = end;
  }
  return chunks;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function score(queryTokens: string[], chunkTokens: string[]): number {
  if (!queryTokens.length || !chunkTokens.length) {
    return 0;
  }
  const set = new Set(chunkTokens);
  let match = 0;
  for (const token of queryTokens) {
    if (set.has(token)) {
      match += 1;
    }
  }
  return match / queryTokens.length;
}

export function retrieveTopChunks(query: string, chunks: IngestedChunk[], topK = 3): IngestedChunk[] {
  const queryTokens = tokenize(query);
  return [...chunks]
    .map((chunk) => ({
      chunk,
      score: score(queryTokens, tokenize(chunk.text)),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((item) => item.chunk);
}
