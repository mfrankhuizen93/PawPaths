import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import { transformSync } from "esbuild";
import { createRequire } from "node:module";
import searchModule from "../shared/utils/location-search.ts";
import filterModule from "../server/utils/location-search-filter.ts";
const { readLocationSearch, writeLocationSearch } = searchModule;
const { buildLocationSearchFilter } = filterModule;

// Evaluate the Mongo match operators used by the filter against representative
// published records, including the array/missing-field behavior that caused #26.
function values(record, path) {
  return path
    .split(".")
    .reduce(
      (items, key) =>
        items.flatMap((item) =>
          Array.isArray(item)
            ? item.map((value) => value?.[key])
            : [item?.[key]],
        ),
      [record],
    )
    .flat();
}
function matches(record, clause) {
  return Object.entries(clause).every(([key, expected]) => {
    if (key === "$and")
      return expected.every((value) => matches(record, value));
    if (key === "$or") return expected.some((value) => matches(record, value));
    if (key === "$expr") return expected.$eq[0] === expected.$eq[1];
    const actual = values(record, key);
    if (expected instanceof RegExp)
      return actual.some(
        (value) => typeof value === "string" && expected.test(value),
      );
    if (expected && typeof expected === "object" && !Array.isArray(expected))
      return Object.entries(expected).every(([op, value]) => {
        if (op === "$in") return actual.some((item) => value.includes(item));
        if (op === "$nin") return actual.every((item) => !value.includes(item));
        if (op === "$ne")
          return (
            actual.every((item) => item !== value) &&
            !(Array.isArray(value) && !value.length && !actual.length)
          );
        if (op === "$exists")
          return actual.some((item) => item !== undefined) === value;
        throw new Error(`Unsupported operator ${op}`);
      });
    return actual.includes(expected);
  });
}
const area = (overrides = {}) => ({
  status: "published",
  name: "Park",
  type: ["park"],
  characteristics: [],
  coordinatePoints: [],
  ...overrides,
});
const result = (query, record) =>
  matches(record, buildLocationSearchFilter(readLocationSearch(query).filters));

test("negative attributes exclude missing/unknown data and respect explicit values over legacy positives", () => {
  for (const [key, tag] of [
    ["fenced", "fenced"],
    ["swimming", "swimming water"],
    ["wheelchairAccessible", "wheelchair accessible"],
  ]) {
    assert.equal(result({ [key]: "no" }, area()), false);
    assert.equal(
      result({ [key]: "yes" }, area({ characteristics: [tag] })),
      true,
    );
    assert.equal(
      result(
        { [key]: "yes" },
        area({ characteristics: [tag], attributes: { [key]: "unknown" } }),
      ),
      false,
    );
    assert.equal(
      result({ [key]: "unknown" }, area({ attributes: { [key]: "unknown" } })),
      true,
    );
    assert.equal(
      result(
        { [key]: "no" },
        area({ attributes: { [key]: "no" }, characteristics: [tag] }),
      ),
      true,
    );
    assert.equal(
      result(
        { [key]: "yes" },
        area({ attributes: { [key]: "no" }, characteristics: [tag] }),
      ),
      false,
    );
  }
  assert.equal(
    result(
      { offLeash: "everywhere" },
      area({ characteristics: ["off-leash area"] }),
    ),
    false,
  );
  assert.equal(
    result(
      { offLeash: "partial" },
      area({ characteristics: ["off-leash area"] }),
    ),
    true,
  );
  assert.equal(result({ offLeash: "not-allowed" }, area()), false);
  assert.equal(
    result(
      { offLeash: "not-allowed" },
      area({ attributes: { offLeash: "not-allowed" } }),
    ),
    true,
  );
});

test("facilities, parking and hazards require recorded positive evidence; legacy exclusion cannot imply no", () => {
  assert.equal(result({ parking: "yes" }, area()), false);
  assert.equal(
    result(
      { parking: "yes" },
      area({ coordinatePoints: [{ kind: "parking" }] }),
    ),
    true,
  );
  assert.equal(
    result(
      { facility: ["cafe", "toilet"] },
      area({ coordinatePoints: [{ kind: "cafe" }] }),
    ),
    false,
  );
  assert.equal(
    result(
      { facility: ["cafe", "toilet"] },
      area({
        characteristics: ["food and drink"],
        coordinatePoints: [{ kind: "toilet" }],
      }),
    ),
    true,
  );
  assert.equal(result({ hazard: "cyclists nearby" }, area()), false);
  assert.equal(
    result(
      { hazard: "cyclists nearby" },
      area({ warnings: ["cyclists nearby"] }),
    ),
    true,
  );
  assert.equal(result({ excludeCharacteristic: "fenced" }, area()), false);
  assert.equal(
    result(
      { excludeCharacteristic: "fenced" },
      area({ attributes: { fenced: "no" } }),
    ),
    true,
  );
  assert.equal(
    result({ excludeCharacteristic: "food and drink" }, area()),
    false,
  );
});

test("search matches names and geographical areas literally, combining all filters", () => {
  assert.equal(
    result({ q: "North Holland" }, area({ province: "North Holland" })),
    true,
  );
  assert.equal(result({ q: ".*" }, area()), false);
  assert.equal(
    result(
      { q: "Park", fenced: "yes", parking: "yes" },
      area({
        attributes: { fenced: "yes" },
        coordinatePoints: [{ kind: "parking" }],
      }),
    ),
    true,
  );
  assert.equal(result({ q: "Park" }, area({ status: "pending" })), false);
});

test("URL mode switching and reload preserve query, filters, spatial scope and detail intent", () => {
  const initial = readLocationSearch({
    q: "Dunes",
    fenced: "no",
    facility: ["cafe", "toilet"],
    minRating: "4",
    lat: "52",
    lng: "4",
    radiusKm: "10",
    west: "3",
    east: "5",
    south: "51",
    north: "53",
    mode: "map",
  });
  const url = writeLocationSearch(
    { ...initial, mode: "list" },
    { location: "dunes", profile: "true" },
  );
  assert.deepEqual(readLocationSearch(url), { ...initial, mode: "list" });
  assert.equal(url.location, "dunes");
  assert.equal(url.profile, "true");
  assert.deepEqual(
    readLocationSearch(
      writeLocationSearch({ ...readLocationSearch(url), mode: "map" }),
    ),
    initial,
  );
});

test("stale and malformed URL values are normalized without creating a zero-degree distance search", () => {
  assert.deepEqual(
    readLocationSearch({
      fenced: "false",
      type: ["park", "obsolete"],
      facility: "unknown",
      minRating: "99",
      lat: null,
      lng: "",
      radiusKm: "10",
      mode: "obsolete",
      south: "53",
      north: "51",
      west: "1",
      east: "5",
    }),
    { filters: { type: ["park"] }, bounds: undefined, mode: "map" },
  );
  assert.equal(
    readLocationSearch({ lat: "91", lng: "4", radiusKm: "10" }).filters.lat,
    undefined,
  );
  assert.equal(
    readLocationSearch({ lat: "0", lng: "0", radiusKm: "5" }).filters.lat,
    0,
  );
});

const require = createRequire(import.meta.url);
async function api(query) {
  const pipelines = [];
  const source = await fs.readFile("server/api/locations.get.ts", "utf8");
  const code = transformSync(source, { loader: "ts", format: "cjs" }).code;
  const module = { exports: {} };
  new Function("require", "module", code)((name) => {
    if (name === "h3")
      return {
        defineEventHandler: (value) => value,
        getQuery: () => query,
        setHeader() {},
      };
    if (name.endsWith("mongodb.js"))
      return {
        getDb: async () => ({
          collection: () => ({
            aggregate: (pipeline) => ({
              toArray: async () => {
                pipelines.push(pipeline);
                return [];
              },
            }),
          }),
        }),
      };
    if (name === "#shared/utils/location-search") return searchModule;
    if (name.endsWith("location-search-filter")) return filterModule;
    if (name === "#shared/utils/location-contract")
      return { normalizeAreaAttributes: () => ({}) };
    return require(
      name === "../utils/location-warnings.js"
        ? "../server/utils/location-warnings.js"
        : name,
    );
  }, module);
  const response = await module.exports.default({});
  return { response, pipelines };
}

test("API intersects distance and viewport, excludes unrated results, and keeps list pagination", async () => {
  const { pipelines, response } = await api({
    lat: "52",
    lng: "4",
    radiusKm: "10",
    west: "3",
    east: "5",
    south: "51",
    north: "53",
    minRating: "4",
    limit: "20",
  });
  assert.equal(pipelines.length, 2);
  assert.equal(pipelines[0][0].$geoNear.maxDistance, 10000);
  assert.ok(pipelines[0][0].$geoNear.query.$and);
  assert.deepEqual(
    pipelines[0].find((stage) => stage.$match?.averageRating),
    { $match: { averageRating: { $gte: 4 } } },
  );
  assert.equal(response.limit, 20);
  assert.equal(response.nextCursor, null);
  const map = await api({
    viewport: "true",
    west: "3",
    east: "5",
    south: "51",
    north: "53",
  });
  assert.equal(map.pipelines.length, 1);
  assert.ok(map.pipelines[0][0].$match.$and[1].location);
  const malformed = await api({
    lat: "",
    lng: null,
    radiusKm: "10",
    west: "",
    east: "5",
    south: "51",
    north: "53",
  });
  assert.ok(malformed.pipelines[0][0].$match);
});
