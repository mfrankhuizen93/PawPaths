import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import { parse, compileScript } from "@vue/compiler-sfc";
import { transformSync } from "esbuild";
import { createSSRApp, computed, defineComponent, h } from "vue";
import { renderToString } from "vue/server-renderer";
import markdownText from "../shared/utils/markdown-text.ts";

const require = createRequire(import.meta.url);
async function loadComponent(name, dependencies = {}) {
  const source = await fs.readFile(`app/components/common/${name}.vue`, "utf8");
  const { descriptor } = parse(source);
  const compiled = compileScript(descriptor, {
    id: name,
    inlineTemplate: true,
  });
  const code = transformSync(compiled.content, {
    loader: "ts",
    format: "cjs",
  }).code;
  const module = { exports: {} };
  new Function("require", "module", "exports", "computed", code)(
    (id) => dependencies[id] ?? require(id),
    module,
    module.exports,
    computed,
  );
  return module.exports.default;
}
const inline = await loadComponent("AppMarkdownInline");
const component = await loadComponent("AppMarkdownText", {
  "#shared/utils/markdown-text": markdownText,
  "~/components/common/AppMarkdownInline.vue": inline,
});
async function render(content) {
  const app = createSSRApp(component, { content });
  app.component(
    "NuxtLink",
    defineComponent({
      props: ["to", "external"],
      setup:
        (props, { slots, attrs }) =>
        () =>
          h("a", { ...attrs, href: props.to }, slots.default?.()),
    }),
  );
  return renderToString(app);
}

test("renders semantic formatting, lists, quotes and secure external links", async () => {
  const html = await render(
    "**Access**\nA *quiet* ~~closed~~ trail.\n- Dogs welcome\n- [Details](https://example.com)\n1. Park\n2. Walk\n> Respect wildlife",
  );
  for (const tag of ["strong", "em", "s", "ul", "ol", "li", "blockquote"])
    assert.match(html, new RegExp(`<${tag}[ >]`));
  assert.match(html, /href="https:\/\/example.com"/);
  assert.match(html, /target="_blank"/);
  assert.match(html, /rel="noopener noreferrer"/);
});

test("escapes raw HTML and never renders unsafe Markdown links as anchors", async () => {
  const html = await render(
    "<img src=x onerror=alert(1)>\n<script>alert(1)</script>\n[bad](javascript:alert) [bad](data:text/html,test)",
  );
  assert.doesNotMatch(html, /<(img|script|a)[ >]/);
  assert.match(html, /&lt;img/);
  assert.match(html, /&lt;script/);
  assert.match(html, /javascript:alert/);
});

test("empty, malformed and multiline descriptions remain readable", async () => {
  for (const value of ["", null, undefined, " \n\n"])
    assert.doesNotMatch(await render(value), /<(p|a|li)[ >]/);
  const html = await render(
    "First line\r\nSecond line\n\n**unfinished [link](broken",
  );
  assert.match(html, /First line\nSecond line/);
  assert.match(html, /whitespace-pre-line/);
  assert.match(html, /\*\*unfinished \[link\]\(broken/);
});

test("the shared location form selects the renderer only in readonly mode", async () => {
  const source = await fs.readFile(
    "app/components/AppLocationForm.vue",
    "utf8",
  );
  const { descriptor, errors } = parse(source);
  assert.deepEqual(errors, []);
  assert.match(
    descriptor.template.content,
    /<AppMarkdownText\s+v-if="readonly"\s+:content="form.description"/,
  );
  assert.match(descriptor.template.content, /<UEditor\s+v-else\s/);
  assert.match(
    descriptor.template.content,
    /v-model="form.description"[\s\S]*?content-type="markdown"/,
  );
});
