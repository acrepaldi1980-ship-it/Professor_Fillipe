import type { ReactNode } from "react";

// Tiny renderer for the teacher's `display_markdown` (headings, lists, bold, italics): no dependency, no raw HTML.
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) =>
    part.startsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : part.startsWith("*") && part.length > 2 ? <em key={i}>{part.slice(1, -1)}</em> : part,
  );
}

export function MiniMarkdown({ text, className }: { text: string; className?: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) blocks.push(<ul key={`l${blocks.length}`} className="my-1 list-disc pl-5">{list.map((x, i) => <li key={i}>{inline(x)}</li>)}</ul>);
    list = [];
  };
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    const li = /^\s*(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line);
    const h = /^#{1,4}\s+(.*)$/.exec(line);
    if (li) list.push(li[1]);
    else {
      flush();
      if (h) blocks.push(<h3 key={blocks.length} className="mt-2 text-lg font-semibold">{inline(h[1])}</h3>);
      else if (line.trim()) blocks.push(<p key={blocks.length} className="my-1">{inline(line)}</p>);
    }
  }
  flush();
  return <div className={className}>{blocks}</div>;
}
