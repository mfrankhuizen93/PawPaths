export type MarkdownTextInline =
  | { type: "text"; text: string }
  | { type: "strong"; text: string }
  | { type: "emphasis"; text: string }
  | { type: "strike"; text: string }
  | { type: "link"; text: string; href: string };

export type MarkdownTextBlock =
  | { type: "paragraph"; children: MarkdownTextInline[] }
  | { type: "list"; ordered: boolean; items: MarkdownTextInline[][] };

const orderedListMarkerPattern = /^\d+\.\s+/;
const unorderedListMarkerPattern = /^[-*]\s+/;

export function parseMarkdownText(content = ""): MarkdownTextBlock[] {
  return content
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/g)
    .map((block) => parseMarkdownBlock(block))
    .filter((block): block is MarkdownTextBlock => Boolean(block));
}

function parseMarkdownBlock(block: string): MarkdownTextBlock | null {
  const lines = block
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim());

  if (!lines.length) return null;

  const ordered = lines.every((line) =>
    orderedListMarkerPattern.test(line.trimStart()),
  );
  const unordered = lines.every((line) =>
    unorderedListMarkerPattern.test(line.trimStart()),
  );

  if (ordered || unordered) {
    const markerPattern = ordered
      ? orderedListMarkerPattern
      : unorderedListMarkerPattern;

    return {
      type: "list",
      ordered,
      items: lines.map((line) =>
        parseMarkdownInline(line.trimStart().replace(markerPattern, "")),
      ),
    };
  }

  return {
    type: "paragraph",
    children: parseMarkdownInline(lines.join("\n")),
  };
}

export function parseMarkdownInline(content: string): MarkdownTextInline[] {
  const nodes: MarkdownTextInline[] = [];
  let position = 0;

  while (position < content.length) {
    const next = findNextToken(content, position);

    if (!next) {
      pushText(nodes, content.slice(position));
      break;
    }

    pushText(nodes, content.slice(position, next.index));

    if (next.type === "link") {
      const parsed = parseLink(content, next.index);

      if (parsed) {
        nodes.push(parsed.node);
        position = parsed.end;
        continue;
      }
    } else {
      const parsed = parseDelimitedText(content, next.index, next.marker);

      if (parsed) {
        nodes.push({ type: next.type, text: parsed.text });
        position = parsed.end;
        continue;
      }
    }

    pushText(nodes, content[next.index] ?? "");
    position = next.index + 1;
  }

  return nodes;
}

function findNextToken(
  content: string,
  position: number,
): { index: number; marker: string; type: Exclude<MarkdownTextInline["type"], "text"> } | null {
  const candidates = [
    { index: content.indexOf("**", position), marker: "**", type: "strong" },
    { index: content.indexOf("~~", position), marker: "~~", type: "strike" },
    { index: content.indexOf("*", position), marker: "*", type: "emphasis" },
    { index: content.indexOf("[", position), marker: "[", type: "link" },
  ] as const;

  return (
    candidates
      .filter((candidate) => candidate.index >= 0)
      .sort((first, second) => first.index - second.index)[0] ?? null
  );
}

function parseDelimitedText(
  content: string,
  start: number,
  marker: string,
): { text: string; end: number } | null {
  const contentStart = start + marker.length;
  const end = content.indexOf(marker, contentStart);
  const text = content.slice(contentStart, end);

  if (end < 0 || !text.trim()) return null;

  return { text, end: end + marker.length };
}

function parseLink(
  content: string,
  start: number,
): { node: MarkdownTextInline; end: number } | null {
  const labelEnd = content.indexOf("]", start + 1);
  const hrefStart = labelEnd >= 0 ? labelEnd + 2 : -1;

  if (labelEnd < 0 || content[labelEnd + 1] !== "(") return null;

  const hrefEnd = content.indexOf(")", hrefStart);
  const text = content.slice(start + 1, labelEnd);
  const href = content.slice(hrefStart, hrefEnd);

  if (hrefEnd < 0 || !text.trim() || !isSafeHref(href)) return null;

  return {
    node: { type: "link", text, href },
    end: hrefEnd + 1,
  };
}

function isSafeHref(href: string) {
  return /^(https?:\/\/|mailto:|\/)/i.test(href);
}

function pushText(nodes: MarkdownTextInline[], text: string) {
  if (!text) return;

  const previous = nodes[nodes.length - 1];

  if (previous?.type === "text") {
    previous.text += text;
    return;
  }

  nodes.push({ type: "text", text });
}

export default {
  parseMarkdownInline,
  parseMarkdownText,
};
