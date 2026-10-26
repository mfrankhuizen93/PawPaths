import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import { parse, compileScript } from "@vue/compiler-sfc";
import { transformSync } from "esbuild";
import * as vue from "vue";
import geocoding from "../server/utils/reverse-geocode.ts";
import lookupModule from "../app/utils/location-place-details.ts";
import coordinates from "../shared/utils/location-coordinates.ts";

const { formatReverseGeocodeResult } = geocoding;
const { createPlaceDetailsLookup } = lookupModule;
const place = {
  name: "Vondelpark",
  address: "Vondelpark 3, 1071 AA Amsterdam",
  city: "Amsterdam",
  province: "North Holland",
  country: "Netherlands",
};

test("reverse lookup presents an area name and a readable street address", () => {
  assert.deepEqual(
    formatReverseGeocodeResult({
      name: "Vondelpark",
      category: "leisure",
      type: "park",
      address: {
        road: "Vondelpark",
        house_number: "3",
        postcode: "1071 AA",
        city: "Amsterdam",
        state: "North Holland",
        country: "Netherlands",
      },
    }),
    place,
  );
  assert.equal(
    formatReverseGeocodeResult({
      address: { nature_reserve: "Dunes", village: "Overveen" },
    }).name,
    "Dunes",
  );
  assert.equal(
    formatReverseGeocodeResult({
      address: { road: "Park Road", town: "Haarlem" },
    }).address,
    "Park Road, Haarlem",
  );
  assert.deepEqual(formatReverseGeocodeResult({}), {
    name: null,
    address: null,
    city: null,
    province: null,
    country: null,
  });
});

test("display lookups share requests by exact pair, serialize different points, and retry errors", async () => {
  let calls = 0;
  let active = 0;
  const lookup = createPlaceDetailsLookup(async (position) => {
    assert.equal(active, 0);
    active++;
    calls++;
    await Promise.resolve();
    active--;
    if (position.latitude === 0 && calls === 3) throw new Error("Unavailable");
    return { ...place };
  }, 0);
  const position = { latitude: 52, longitude: 4 };
  const first = lookup(position);
  assert.equal(lookup({ ...position }), first);
  position.latitude = 53;
  await Promise.all([first, lookup(position)]);
  assert.equal(calls, 2);
  await assert.rejects(lookup({ latitude: 0, longitude: 0 }), /Unavailable/);
  assert.deepEqual(await lookup({ latitude: 0, longitude: 0 }), place);
  assert.equal(calls, 4);
});

const require = createRequire(import.meta.url);
async function summary() {
  const source = await fs.readFile(
    "app/components/AppLocationPositionSummary.vue",
    "utf8",
  );
  const { descriptor } = parse(source);
  const script = compileScript(descriptor, { id: "place-summary" }).content;
  const code = transformSync(script, { loader: "ts", format: "cjs" }).code;
  const mounted = [];
  const timers = [];
  const requests = [];
  const bindings = {
    ref: vue.ref,
    computed: vue.computed,
    watch: vue.watch,
    onMounted(callback) {
      mounted.push(callback);
    },
    setTimeout(callback) {
      timers.push(callback);
      return timers.length;
    },
    clearTimeout() {},
  };
  const module = { exports: {} };
  new Function("require", "module", ...Object.keys(bindings), code)(
    (name) => {
      if (name === "#shared/utils/location-coordinates") return coordinates;
      if (name === "~/utils/location-place-details")
        return {
          getLocationPlaceDetails(position) {
            return new Promise((resolve, reject) =>
              requests.push({ position, resolve, reject }),
            );
          },
        };
      return require(name);
    },
    module,
    ...Object.values(bindings),
  );
  const props = vue.reactive({ latitude: 52, longitude: 4 });
  const state = module.exports.default.setup(props, { expose() {} });
  mounted[0]();
  return { props, state, timers, requests };
}

test("place summary ignores late lookups after switching points and never modifies coordinates", async () => {
  const { props, state, timers, requests } = await summary();
  const oldRequest = timers.shift()();
  props.latitude = 53;
  await vue.nextTick();
  const newRequest = timers.shift()();
  requests[1].resolve({ ...place, name: "New area" });
  await newRequest;
  requests[0].resolve(place);
  await oldRequest;
  assert.equal(state.details.value.name, "New area");
  assert.deepEqual({ ...props }, { latitude: 53, longitude: 4 });
  assert.equal(state.loading.value, false);
});

test("lookup failures and missing place data leave the pin usable without stale labels", async () => {
  const { props, state, timers, requests } = await summary();
  const pending = timers.shift()();
  requests[0].reject(new Error("Network failure"));
  await pending;
  assert.deepEqual(state.lines.value, []);
  assert.equal(state.hasPosition.value, true);
  assert.equal(state.loading.value, false);
  props.latitude = null;
  await vue.nextTick();
  assert.equal(state.hasPosition.value, false);
  assert.deepEqual(state.lines.value, []);
});
