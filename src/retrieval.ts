import type { Source } from "./types.js";
export type Chunk = {
  sourceId: string;
  title: string;
  chunkId: string;
  quote: string;
  score: number;
};
const ignored = new Set(
  "the and for with what which how does from this that are can you your into about a an is to of in on it we our".split(
    " ",
  ),
);
export function words(text: string) {
  return [
    ...new Set(
      (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(
        (w) => w.length > 2 && !ignored.has(w),
      ),
    ),
  ];
}
export function retrieve(
  question: string,
  sources: Source[],
  max = 5,
): Chunk[] {
  const terms = words(question);
  if (!terms.length) return [];
  const chunks: Chunk[] = [];
  for (const source of sources) {
    const paragraphs = source.content.split(/\n\s*\n/);
    let index = 0;
    for (const paragraph of paragraphs) {
      for (let start = 0; start < paragraph.length; start += 700) {
        const quote = paragraph.slice(start, start + 800).trim();
        if (!quote) continue;
        const hay = words(source.title + " " + quote);
        const score =
          terms.filter((t) => hay.includes(t)).length / terms.length;
        chunks.push({
          sourceId: source.id,
          title: source.title,
          chunkId: source.id + ":" + index++,
          quote,
          score,
        });
      }
    }
  }
  return chunks
    .filter((c) => c.score >= 0.2)
    .sort((a, b) => b.score - a.score || a.chunkId.localeCompare(b.chunkId))
    .slice(0, max);
}
