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

const { default: locationDescription } =
  await import("../server/utils/location-description.ts");
const { generateLocationDescription } = locationDescription;

const markdown = `## What makes this location unique?
A quiet woodland loop.

## Off-leash rules
Dogs may be off leash in the marked area.

## Terrain & environment
Mostly unpaved forest paths.

## Water access
Details have not been provided yet.

## Safety considerations
Watch for cyclists.

## Local tips
Visit early for easier parking.`;

test("generates the required Markdown structure and includes existing notes", async () => {
  let requestBody;
  const description = await generateLocationDescription(
    {
      name: "Loop Park",
      description: "Dogs can run free. Watch for cyclists.",
      type: ["park"],
      characteristics: ["off-leash area"],
    },
    {
      apiKey: "test-key",
      model: "test-model",
      async fetcher(_url, options) {
        requestBody = JSON.parse(options.body);

        return new Response(
          JSON.stringify({
            output_text: JSON.stringify({ markdown }),
          }),
          { status: 200 },
        );
      },
    },
  );

  assert.equal(description, markdown);
  assert.equal(requestBody.model, "test-model");
  assert.match(
    requestBody.input[1].content,
    /Dogs can run free\. Watch for cyclists\./,
  );
});

test("rejects generated descriptions that omit a required section", async () => {
  await assert.rejects(
    generateLocationDescription(
      { name: "Loop Park" },
      {
        apiKey: "test-key",
        async fetcher() {
          return new Response(
            JSON.stringify({
              output_text: JSON.stringify({
                markdown: "## What makes this location unique?\nA park.",
              }),
            }),
            { status: 200 },
          );
        },
      },
    ),
    (error) =>
      error.statusCode === 502 &&
      error.statusMessage === "OpenAI returned an invalid description.",
  );
});
