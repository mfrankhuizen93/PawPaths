import assert from "node:assert/strict";
import Module from "node:module";
import test from "node:test";

const originalResolveFilename = Module._resolveFilename;

Module._resolveFilename = function resolveNuxtAliases(
  request,
  parent,
  isMain,
  options,
) {
  if (request.startsWith("#shared/")) {
    return originalResolveFilename.call(
      this,
      `${process.cwd()}/${request.replace("#shared/", "shared/")}.ts`,
      parent,
      isMain,
      options,
    );
  }

  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const { default: locationPermissions } =
  await import("../shared/utils/location-permissions.ts");
const { canDeleteLocation, canSuggestLocationUnavailable } =
  locationPermissions;

test("only admins can delete locations", () => {
  assert.equal(canDeleteLocation("admin"), true);
  assert.equal(canDeleteLocation("maintainer"), false);
  assert.equal(canDeleteLocation("user"), false);
  assert.equal(canDeleteLocation(null), false);
});

test("maintainers can suggest that a location is unavailable", () => {
  assert.equal(canSuggestLocationUnavailable("admin"), true);
  assert.equal(canSuggestLocationUnavailable("maintainer"), true);
  assert.equal(canSuggestLocationUnavailable("user"), false);
  assert.equal(canSuggestLocationUnavailable(undefined), false);
});
