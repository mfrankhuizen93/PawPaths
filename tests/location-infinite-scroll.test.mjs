import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import { parse, compileScript } from "@vue/compiler-sfc";
import { transformSync } from "esbuild";
import * as vue from "vue";

async function pagination(fetchPage) {
  const source = await fs.readFile("app/pages/index.vue", "utf8");
  const { descriptor } = parse(source);
  const script = compileScript(descriptor, { id: "pagination" });
  const node = script.scriptSetupAst.find(
    (node) =>
      node.type === "FunctionDeclaration" &&
      node.id.name === "loadMoreLocations",
  );
  const code = transformSync(
    descriptor.scriptSetup.content.slice(node.start, node.end),
    { loader: "ts", format: "cjs" },
  ).code;
  const state = {
    nextCursor: vue.ref("page-2"),
    loadingMore: vue.ref(false),
    pending: vue.ref(false),
    loadMoreError: vue.ref(""),
    locationsQuery: vue.ref({ limit: 20, q: "Dunes" }),
    locations: vue.ref([{ id: "first" }]),
    $fetch: fetchPage,
  };
  const loadMore = new Function(
    ...Object.keys(state),
    `${code}; return loadMoreLocations;`,
  )(...Object.values(state));
  return { state, loadMore };
}

test("infinite pagination serializes requests, retains cards on failure, and retries the same cursor", async () => {
  const requests = [];
  let resolvePage;
  const { state, loadMore } = await pagination((_url, options) => {
    requests.push(options.query);
    return new Promise((resolve) => {
      resolvePage = resolve;
    });
  });
  const first = loadMore();
  await loadMore();
  assert.equal(requests.length, 1);
  assert.equal(state.loadingMore.value, true);
  resolvePage({ items: [{ id: "second" }], nextCursor: "page-3" });
  await first;
  assert.deepEqual(
    state.locations.value.map((item) => item.id),
    ["first", "second"],
  );
  assert.equal(state.nextCursor.value, "page-3");
  const retryCursors = [];
  const failed = await pagination(async (_url, options) => {
    retryCursors.push(options.query.cursor);
    if (retryCursors.length === 1) throw new Error("Offline");
    return { items: [{ id: "retried" }], nextCursor: null };
  });
  await failed.loadMore();
  assert.equal(failed.state.loadMoreError.value.length > 0, true);
  assert.equal(failed.state.nextCursor.value, "page-2");
  assert.deepEqual(failed.state.locations.value, [{ id: "first" }]);
  await failed.loadMore();
  assert.deepEqual(retryCursors, ["page-2", "page-2"]);
  assert.equal(failed.state.loadMoreError.value, "");
  assert.deepEqual(failed.state.locations.value, [
    { id: "first" },
    { id: "retried" },
  ]);
  state.nextCursor.value = null;
  await loadMore();
  assert.equal(requests.length, 1);
  state.nextCursor.value = "page-3";
  state.pending.value = true;
  await loadMore();
  assert.equal(requests.length, 1);
});

test("a late pagination response cannot append results or errors after the query changes", async () => {
  for (const reject of [false, true]) {
    let settle;
    const { state, loadMore } = await pagination(
      () =>
        new Promise((resolve, rejectPage) => {
          settle = () =>
            reject
              ? rejectPage(new Error("Old query failed"))
              : resolve({ items: [{ id: "stale" }], nextCursor: null });
        }),
    );
    const request = loadMore();
    state.locationsQuery.value = { limit: 20, q: "Forest" };
    state.locations.value = [{ id: "new-query" }];
    state.nextCursor.value = "forest-page-2";
    settle();
    await request;
    assert.deepEqual(state.locations.value, [{ id: "new-query" }]);
    assert.equal(state.nextCursor.value, "forest-page-2");
    assert.equal(state.loadMoreError.value, "");
    assert.equal(state.loadingMore.value, false);
  }
});

test("infinite scrolling waits for pagination and stops for pending, error, loading, and exhausted states", async () => {
  const source = await fs.readFile(
    "app/components/location/LocationSearchResults.vue",
    "utf8",
  );
  const { descriptor } = parse(source);
  const script = compileScript(descriptor, { id: "infinite-results" }).content;
  const code = transformSync(script, { loader: "ts", format: "cjs" }).code;
  let hook, finish;
  const props = vue.reactive({
    locations: [],
    pending: false,
    more: true,
    loadingMore: false,
    loadMoreError: "",
    loadMore: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  });
  const module = { exports: {} };
  new Function("require", "module", "useTemplateRef", "watch", code)(
    (name) => {
      if (name === "vue") return vue;
      if (name === "@vueuse/core")
        return {
          useInfiniteScroll: (element, load, options) => {
            hook = { element, load, options };
          },
        };
      return {};
    },
    module,
    () => vue.ref(null),
    vue.watch,
  );
  const scope = vue.effectScope();
  scope.run(() =>
    module.exports.default.setup(props, { expose() {}, emit() {} }),
  );
  assert.equal(hook.options.distance, 300);
  assert.equal(hook.options.canLoadMore(), true);
  for (const [key, value] of [
    ["pending", true],
    ["loadingMore", true],
    ["loadMoreError", "Offline"],
    ["more", false],
  ]) {
    const original = props[key];
    props[key] = value;
    assert.equal(hook.options.canLoadMore(), false);
    props[key] = original;
  }
  let completed = false;
  const request = hook.load().then(() => {
    completed = true;
  });
  await Promise.resolve();
  assert.equal(completed, false);
  finish();
  await request;
  assert.equal(completed, true);
  scope.stop();
});
