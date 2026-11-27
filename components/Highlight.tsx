import { foldWithMap, normalizeArabic } from "@/lib/arabic";

export default function Highlight({ text, query }: { text: string; query: string }) {
  const needle = normalizeArabic(query.trim().toLowerCase());
  if (!needle || !text) return <>{text}</>;

  const { text: haystack, map } = foldWithMap(text.toLowerCase());
  const ranges: [number, number][] = [];
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    ranges.push([map[index], map[index + needle.length - 1] + 1]);
    index = haystack.indexOf(needle, index + needle.length);
  }
  if (ranges.length === 0) return <>{text}</>;

  const parts: React.ReactNode[] = [];
  let from = 0;
  ranges.forEach(([start, end], i) => {
    if (start > from) parts.push(text.slice(from, start));
    parts.push(
      <mark key={i} className="rounded-sm bg-amber-200 text-inherit">
        {text.slice(start, end)}
      </mark>,
    );
    from = end;
  });
  if (from < text.length) parts.push(text.slice(from));
  return <>{parts}</>;
}

export function matches(text: string, query: string) {
  const needle = normalizeArabic(query.trim().toLowerCase());
  return Boolean(needle) && foldWithMap(text.toLowerCase()).text.includes(needle);
}
