import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";
import { parse, compileScript } from "@vue/compiler-sfc";
import { transformSync } from "esbuild";
import * as vue from "vue";
import coordinates from "../shared/utils/location-coordinates.ts";

const require = createRequire(import.meta.url);

// Run the real SFC setup and map event callbacks with an isolated MapLibre double.
async function picker() {
  const source = await fs.readFile(
    "app/components/AppLocationPointPicker.vue",
    "utf8",
  );
  const { descriptor } = parse(source);
  const script = compileScript(descriptor, {
    id: "picker-test",
  }).content.replace('await import("maplibre-gl")', "await __loadMap()");
  const code = transformSync(script, { loader: "ts", format: "cjs" }).code;
  const mounted = [];
  const events = {};
  const emitted = [];
  let feature = null;
  const map = {
    addControl() {},
    getSource() {
      return null;
    },
    addSource() {},
    addLayer() {},
    getZoom() {
      return 14;
    },
    easeTo() {},
    fitBounds() {},
    on(name, handler) {
      events[name] = handler;
    },
    queryRenderedFeatures() {
      return feature ? [feature] : [];
    },
  };
  const bindings = {
    ref: vue.ref,
    shallowRef: vue.shallowRef,
    computed: vue.computed,
    watch: vue.watch,
    onMounted(callback) {
      mounted.push(callback);
    },
    onBeforeUnmount() {},
    useRuntimeConfig() {
      return { public: {} };
    },
    async __loadMap() {
      return {
        Map: function () {
          return map;
        },
        NavigationControl: function () {},
        AttributionControl: function () {},
      };
    },
  };
  const module = { exports: {} };
  new Function("require", "module", ...Object.keys(bindings), code)(
    (name) =>
      name === "#shared/utils/location-coordinates"
        ? coordinates
        : require(name),
    module,
    ...Object.values(bindings),
  );
  const props = vue.reactive({ markers: [], placing: true, readonly: false });
  const state = module.exports.default.setup(props, {
    expose() {},
    emit(...args) {
      emitted.push(args);
    },
  });
  state.mapContainer.value = {};
  await mounted[0]();
  return {
    props,
    state,
    events,
    emitted,
    setFeature(value) {
      feature = value;
    },
  };
}

test("map load gates placement; click and address selection emit exactly one rounded coordinate pair", async () => {
  const { state, events, emitted } = await picker();
  const click = {
    lngLat: { lat: 52.123456789, lng: 4.987654321 },
    point: { x: 1, y: 2 },
  };
  events.click(click);
  state.searchAddress({ latitude: 52, longitude: 4 });
  assert.deepEqual(emitted, []);
  events.load();
  events.click(click);
  state.searchAddress({ latitude: -12.987654321, longitude: 130.123456789 });
  assert.deepEqual(emitted, [
    ["picked", { latitude: 52.123457, longitude: 4.987654 }],
    ["picked", { latitude: -12.987654, longitude: 130.123457 }],
  ]);
  state.searchAddress({ latitude: 91, longitude: 4 });
  assert.equal(emitted.length, 2);
});

test("idle marker clicks select identity, while readonly and idle background clicks cannot move coordinates", async () => {
  const { props, events, emitted, setFeature } = await picker();
  events.load();
  props.placing = false;
  const click = { lngLat: { lat: 52, lng: 4 }, point: { x: 1, y: 2 } };
  events.click(click);
  assert.deepEqual(emitted, []);
  setFeature({ properties: { id: "gate", kind: "entrance", label: "Gate" } });
  events.click(click);
  assert.deepEqual(emitted, [
    ["marker-select", { id: "gate", kind: "entrance", label: "Gate" }],
  ]);
  props.readonly = true;
  props.placing = true;
  events.click(click);
  assert.equal(emitted.length, 1);
});

test("selected identities highlight and focus the same record without replacing other markers", async () => {
  const { props, state, events, emitted, setFeature } = await picker();
  props.placing = false;
  props.markers = [
    {
      id: "area",
      kind: "general",
      label: "General location",
      latitude: 51,
      longitude: 3,
    },
    ...Array.from({ length: 8 }, (_, i) => ({
      id: `gate-${i}`,
      kind: "entrance",
      label: "Gate",
      latitude: 52 + i / 10,
      longitude: 4 + i / 10,
    })),
  ];
  events.load();
  props.activeMarkerId = "gate-3";
  assert.deepEqual(state.selectedCoordinates.value, [4.3, 52.3]);
  const data = state.getSelectionFeatureCollection();
  assert.equal(data.features.length, 9);
  assert.deepEqual(
    data.features
      .filter((feature) => feature.properties.selected)
      .map((feature) => feature.properties.id),
    ["gate-3"],
  );
  setFeature(data.features[4]);
  events.click({ point: { x: 1, y: 2 }, lngLat: { lat: 0, lng: 0 } });
  assert.deepEqual(emitted, [
    ["marker-select", { id: "gate-3", kind: "entrance", label: "Gate" }],
  ]);
  assert.deepEqual(
    data.features.map((feature) => feature.properties.id),
    props.markers.map((marker) => marker.id),
  );
});
