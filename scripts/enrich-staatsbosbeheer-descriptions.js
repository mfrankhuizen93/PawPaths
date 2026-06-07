import fs from "node:fs/promises";
import pLimit from "p-limit";
import { getOpenAIConfig, loadEnvFile } from "./env.js";

const SOURCE_PATH = "staatsbosbeheer-locations.json";
const CACHE_PATH = "staatsbosbeheer-translations.json";
const FETCH_CONCURRENCY = 6;
const TRANSLATION_BATCH_SIZE = 20;
const TRANSLATION_CONCURRENCY = 2;

function getArgument(name) {
  const prefix = `--${name}=`;
  const value = process.argv.find((arg) => arg.startsWith(prefix));

  return value ? value.slice(prefix.length) : null;
}

function clean(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtml(value) {
  return String(value ?? "")
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function getResponseOutputText(data) {
  if (typeof data.output_text === "string") return data.output_text;

  return (data.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .filter((text) => typeof text === "string")
    .join("");
}

async function readJson(path, fallback) {
  try {
    return JSON.parse(await fs.readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function fetchIntroduction(candidate) {
  const response = await fetch(candidate.sourceUrl, {
    headers: {
      Accept: "text/html",
      "User-Agent": "Pawpaths location research scraper - contact: your@email.com",
    },
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Failed ${response.status}: ${candidate.sourceUrl}`);
  }

  const html = await response.text();
  const match = html.match(
    /<script[^>]+type=["']application\/data-detailmap["'][^>]*>([\s\S]*?)<\/script>/i,
  );
  if (!match) return clean(candidate.staatsbosbeheer?.route?.introductionNl);

  const detail = JSON.parse(decodeHtml(match[1]));
  return clean(detail.Introduction);
}

async function translateBatch({ apiKey, model, items }) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content:
            "Translate Dutch nature-route descriptions into natural, neutral English. Preserve every factual detail, warning, access restriction, place name, and dog rule. Do not summarize, embellish, add headings, mention the translation, or add information. Return JSON only.",
        },
        {
          role: "user",
          content: `Translate each item. Return one result for every id.\n\n${JSON.stringify(items)}`,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "route_description_translations",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              translations: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    id: { type: "string" },
                    text: { type: "string" },
                  },
                  required: ["id", "text"],
                },
              },
            },
            required: ["translations"],
          },
          strict: true,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(
      `OpenAI request failed (${response.status}): ${await response.text()}`,
    );
  }

  const data = await response.json();
  const outputText = getResponseOutputText(data);
  const parsed = JSON.parse(outputText);

  return parsed.translations;
}

function buildDescription(candidate, introductionEn) {
  const route = candidate.staatsbosbeheer?.route ?? {};
  const facts = [
    `Dog-friendly Staatsbosbeheer walking route${candidate.staatsbosbeheer?.area ? ` in ${candidate.staatsbosbeheer.area}` : ""}${route.lengthKm ? ` (${Number.isInteger(route.lengthKm) ? route.lengthKm : route.lengthKm.toFixed(1)}km)` : ""}.`,
    route.color ? `Follow the ${route.color} route markers.` : null,
  ].filter(Boolean);

  return [...facts, clean(introductionEn)].filter(Boolean).join("\n\n");
}

await loadEnvFile();

const limit = Number(getArgument("limit") ?? 0);
const candidates = await readJson(SOURCE_PATH, []);
const selectedCandidates =
  Number.isInteger(limit) && limit > 0 ? candidates.slice(0, limit) : candidates;
const cache = await readJson(CACHE_PATH, {});
const fetchLimit = pLimit(FETCH_CONCURRENCY);

console.log(
  `Fetching Staatsbosbeheer introductions for ${selectedCandidates.length} routes`,
);
await Promise.all(
  selectedCandidates.map((candidate, index) =>
    fetchLimit(async () => {
      const introductionNl = await fetchIntroduction(candidate);
      candidate.staatsbosbeheer.route.introductionNl = introductionNl || null;

      if ((index + 1) % 50 === 0 || index + 1 === selectedCandidates.length) {
        console.log(
          `Fetched introductions: ${index + 1}/${selectedCandidates.length}`,
        );
      }
    }),
  ),
);

const untranslated = selectedCandidates
  .filter((candidate) => {
    const source = candidate.staatsbosbeheer.route.introductionNl;
    return source && !cache[source];
  })
  .map((candidate) => ({
    id: candidate.sourceUrl,
    text: candidate.staatsbosbeheer.route.introductionNl,
  }));

if (untranslated.length > 0) {
  const openAIConfig = getOpenAIConfig();
  const batches = [];
  for (let index = 0; index < untranslated.length; index += TRANSLATION_BATCH_SIZE) {
    batches.push(untranslated.slice(index, index + TRANSLATION_BATCH_SIZE));
  }

  console.log(
    `Translating ${untranslated.length} introductions in ${batches.length} batches`,
  );
  const translationLimit = pLimit(TRANSLATION_CONCURRENCY);
  let completedBatches = 0;

  await Promise.all(
    batches.map((batch) =>
      translationLimit(async () => {
        const translations = await translateBatch({
          ...openAIConfig,
          items: batch,
        });
        const sourceById = new Map(batch.map((item) => [item.id, item.text]));

        for (const translation of translations) {
          const source = sourceById.get(translation.id);
          if (source && clean(translation.text)) {
            cache[source] = clean(translation.text);
          }
        }

        completedBatches += 1;
        console.log(
          `Translated batches: ${completedBatches}/${batches.length}`,
        );
        await fs.writeFile(CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`);
      }),
    ),
  );
}

for (const candidate of selectedCandidates) {
  const route = candidate.staatsbosbeheer.route;
  const introductionEn = route.introductionNl
    ? cache[route.introductionNl] ?? null
    : null;

  route.introductionEn = introductionEn;
  candidate.description = buildDescription(candidate, introductionEn);
}

await fs.writeFile(SOURCE_PATH, `${JSON.stringify(candidates, null, 2)}\n`);
await fs.writeFile(CACHE_PATH, `${JSON.stringify(cache, null, 2)}\n`);

const withColor = selectedCandidates.filter(
  (candidate) => candidate.staatsbosbeheer.route.color,
).length;
const withTranslation = selectedCandidates.filter(
  (candidate) => candidate.staatsbosbeheer.route.introductionEn,
).length;

console.log("Staatsbosbeheer descriptions enriched");
console.log(`Candidates updated: ${selectedCandidates.length}`);
console.log(`Descriptions with route color: ${withColor}`);
console.log(`Descriptions with translated introduction: ${withTranslation}`);
