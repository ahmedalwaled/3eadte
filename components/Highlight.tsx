export default function Highlight({ text, query }: { text: string; query: string }) {
  const needle = query.trim().toLowerCase();
  if (!needle || !text) return <>{text}</>;

  const haystack = text.toLowerCase();
  const parts: React.ReactNode[] = [];
  let from = 0;
  let index = haystack.indexOf(needle, from);
  while (index !== -1) {
    if (index > from) parts.push(text.slice(from, index));
    parts.push(
      <mark key={index} className="rounded-sm bg-amber-200 text-inherit">
        {text.slice(index, index + needle.length)}
      </mark>,
    );
    from = index + needle.length;
    index = haystack.indexOf(needle, from);
  }
  if (from < text.length) parts.push(text.slice(from));
  return <>{parts}</>;
}

export function matches(text: string, query: string) {
  const needle = query.trim().toLowerCase();
  return Boolean(needle) && text.toLowerCase().includes(needle);
}
