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

test("allows only supported links and rejects browser-normalized unsafe URLs", () => {
  for (const href of [
    "https://example.com/path?q=1&x=2",
    "http://example.com",
    "mailto:hello@example.com",
    "/location/park",
  ]) {
    assert.deepEqual(parseMarkdownInline(`[Details](${href})`), [
      { type: "link", text: "Details", href },
    ]);
  }
  for (const href of [
    "javascript:alert",
    "JaVaScRiPt:alert",
    "data:text/html,test",
    "vbscript:test",
    "file:///tmp/test",
    "//evil.example",
    "/\\evil.example",
    "https://",
    "https://exa\nmple.com",
    "java\tscript:alert",
    " https://example.com",
    "mailto:",
  ]) {
    assert.ok(
      parseMarkdownInline(`[Details](${href})`).every(
        (node) => node.type !== "link",
      ),
      href,
    );
  }
});

test("keeps malformed tokens and HTML literal", () => {
  for (const text of [
    "**unfinished",
    "[missing](",
    "<script>alert(1)</script>",
    "[bad](javascript:alert)",
  ])
    assert.deepEqual(parseMarkdownInline(text), [{ type: "text", text }]);
});

test("recognizes adjacent paragraphs, lists, and quotes without blank separators", () => {
  const blocks = parseMarkdownText(
    "Intro\r\n- One\r\n- Two\r\n1. First\r\n2. Next\r\n> Quote\r\nEnd",
  );
  assert.deepEqual(
    blocks.map((block) => block.type),
    ["paragraph", "list", "list", "quote", "paragraph"],
  );
  assert.equal(blocks[1].ordered, false);
  assert.equal(blocks[2].ordered, true);
});
