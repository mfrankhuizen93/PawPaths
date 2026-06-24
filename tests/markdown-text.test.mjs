import assert from "node:assert/strict";
import test from "node:test";

import markdownText from "../shared/utils/markdown-text.ts";

const { parseMarkdownInline, parseMarkdownText } = markdownText;

test("parses bold markdown without keeping the markers as text", () => {
  assert.deepEqual(parseMarkdownInline("Dogs need **clear signs** here."), [
    { type: "text", text: "Dogs need " },
    { type: "strong", text: "clear signs" },
    { type: "text", text: " here." },
  ]);
});

test("parses generated location descriptions into safe render blocks", () => {
  const blocks = parseMarkdownText(`**What makes this location unique?**
A quiet woodland loop.

**Local tips**

- Visit early
- Watch for [cyclists](https://example.com)`);

  assert.equal(blocks.length, 3);
  assert.deepEqual(blocks[0], {
    type: "paragraph",
    children: [
      { type: "strong", text: "What makes this location unique?" },
      { type: "text", text: "\nA quiet woodland loop." },
    ],
  });
  assert.equal(blocks[2]?.type, "list");
  assert.deepEqual(blocks[2]?.items[1], [
    { type: "text", text: "Watch for " },
    { type: "link", text: "cyclists", href: "https://example.com" },
  ]);
});
