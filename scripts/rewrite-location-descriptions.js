import { MongoClient } from "mongodb";
import pLimit from "p-limit";
import { getMongoConfig, getOpenAIConfig, loadEnvFile } from "./env.js";

const MAX_SENTENCES = 10;
const DEFAULT_LIMIT = 0;
const DEFAULT_CONCURRENCY = 2;

function getArgValue(name, fallback = null) {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function toPositiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function isDoggyDatingText(value) {
  return /doggy[-\s]?dating|doggydating/i.test(String(value ?? ""));
}

function isDoggyDatingUrl(value) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return /(^|\.)doggydating\.com$/i.test(url.hostname);
  } catch {
    return isDoggyDatingText(value);
  }
}

function isDoggyDatingRelatedUrl(relatedUrl) {
  return (
    isDoggyDatingUrl(relatedUrl?.url) || isDoggyDatingText(relatedUrl?.label)
  );
}

function cleanRelatedUrls(relatedUrls = []) {
  return relatedUrls.filter(
    (relatedUrl) => !isDoggyDatingRelatedUrl(relatedUrl),
  );
}

function cleanSourceText(value) {
  return String(value ?? "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !isDoggyDatingText(line))
    .join("\n")
    .slice(0, 4_000);
}

function cleanReviewText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/doggy[-\s]?dating|doggydating/gi, "this location")
    .trim()
    .slice(0, 600);
}

function getReviewText(review) {
  return cleanReviewText(review?.text);
}

function getRelevantReviews(reviews = []) {
  return reviews
    .map((review) => ({
      rating: review.rating ?? null,
      text: getReviewText(review),
    }))
    .filter((review) => review.text.length >= 40)
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, 4);
}

function getSentenceCount(value) {
  const stripped = String(value)
    .replace(/[#*_>`-]/g, "")
    .replace(/\[[^\]]+\]\([^)]+\)/g, "")
    .trim();

  if (!stripped) return 0;

  return stripped.match(/[.!?]+(?=\s|$)/g)?.length ?? 1;
}

function validateMarkdown(markdown) {
  const trimmed = String(markdown ?? "").trim();

  if (!trimmed) return "Markdown description is empty.";
  if (isDoggyDatingText(trimmed)) {
    return "Markdown description mentions DoggyDating.";
  }
  if (/<\/?[a-z][\s\S]*>/i.test(trimmed)) {
    return "Markdown description contains HTML.";
  }
  if (getSentenceCount(trimmed) > MAX_SENTENCES) {
    return `Markdown description has more than ${MAX_SENTENCES} sentences.`;
  }

  return null;
}

function getResponseOutputText(data) {
  if (typeof data.output_text === "string") return data.output_text;

  return (data.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .filter((text) => typeof text === "string")
    .join("");
}

function buildPrompt(location) {
  const locality = [location.city, location.province, location.country]
    .filter(Boolean)
    .join(", ");
  const facts = {
    name: location.name,
    locality,
    type: location.type ?? [],
    characteristics: location.characteristics ?? [],
    warnings: location.warnings ?? [],
    currentDescription: cleanSourceText(location.description),
    usefulReviews: getRelevantReviews(location.reviews),
  };

  return [
    {
      role: "system",
      content:
        "You rewrite dog-friendly location descriptions for PawPaths. Write clear, neutral English in polished Markdown. Focus on the practical visitor experience: landscape, off-leash rules, water, route length, facilities, parking, safety notes, and anything reviewers consistently mention. Do not mention DoggyDating or the source website. Do not invent facts. Keep it compact: at most 8 sentences or bullet items total. Do not start with a title or repeat the location name as a heading. Use 2 to 4 short paragraphs, or 1 to 2 paragraphs plus a maximum of 3 bullets only when it improves scanning. Use tasteful **bold** emphasis for important labels or cautions. Do not use HTML. Return JSON only.",
    },
    {
      role: "user",
      content: `Rewrite this location description as JSON with exactly one key, "markdown". The markdown should be ready to render directly on a location detail page.\n\nLocation data:\n${JSON.stringify(
        facts,
        null,
        2,
      )}`,
    },
  ];
}

async function rewriteDescription({ apiKey, model, location }) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: buildPrompt(location),
      text: {
        format: {
          type: "json_schema",
          name: "location_description",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              markdown: {
                type: "string",
              },
            },
            required: ["markdown"],
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

  if (!outputText) {
    throw new Error("OpenAI response did not include output_text.");
  }

  const parsed = JSON.parse(outputText);
  const validationError = validateMarkdown(parsed.markdown);

  if (validationError) {
    throw new Error(validationError);
  }

  return parsed.markdown.trim();
}

await loadEnvFile();

const apply = hasFlag("apply");
const force = hasFlag("force");
const cleanLinksOnly = hasFlag("clean-links-only");
const limit = toPositiveInteger(getArgValue("limit"), DEFAULT_LIMIT);
const concurrency = toPositiveInteger(
  getArgValue("concurrency"),
  DEFAULT_CONCURRENCY,
);
const { uri, dbName } = getMongoConfig();
const openAIConfig = cleanLinksOnly ? null : getOpenAIConfig();
const client = new MongoClient(uri);

try {
  await client.connect();

  const db = client.db(dbName);
  const locations = db.collection("locations");
  const filter = {
    status: "published",
    ...(force || cleanLinksOnly
      ? {}
      : {
          $or: [
            { descriptionFormat: { $exists: false } },
            { descriptionFormat: { $ne: "markdown" } },
          ],
        }),
  };
  const query = locations
    .find(filter, {
      projection: {
        name: 1,
        city: 1,
        province: 1,
        country: 1,
        type: 1,
        characteristics: 1,
        warnings: 1,
        description: 1,
        descriptionOriginal: 1,
        descriptionFormat: 1,
        descriptionRewrittenAt: 1,
        relatedUrls: 1,
        reviews: 1,
      },
    })
    .sort({ name: 1 });

  if (limit > 0) query.limit(limit);

  const sourceLocations = await query.toArray();
  const runner = pLimit(concurrency);
  let rewrittenCount = 0;
  let cleanedLinkCount = 0;
  let failedCount = 0;

  console.log(`Database: ${db.databaseName}`);
  console.log(`Mode: ${apply ? "apply" : "dry-run"}`);
  console.log(`Locations selected: ${sourceLocations.length}`);

  await Promise.all(
    sourceLocations.map((location) =>
      runner(async () => {
        const relatedUrls = cleanRelatedUrls(location.relatedUrls ?? []);
        const removedLinkCount =
          (location.relatedUrls?.length ?? 0) - relatedUrls.length;

        if (cleanLinksOnly) {
          if (removedLinkCount > 0 && apply) {
            await locations.updateOne(
              { _id: location._id },
              {
                $set: {
                  relatedUrls,
                  updatedAt: new Date(),
                },
              },
            );
          }
          cleanedLinkCount += removedLinkCount > 0 ? 1 : 0;
          return;
        }

        try {
          const markdown = await rewriteDescription({
            ...openAIConfig,
            location,
          });

          if (apply) {
            await locations.updateOne(
              { _id: location._id },
              {
                $set: {
                  description: markdown,
                  descriptionOriginal:
                    location.descriptionOriginal ?? location.description ?? "",
                  descriptionFormat: "markdown",
                  descriptionRewrittenAt: new Date(),
                  descriptionRewriteModel: openAIConfig.model,
                  relatedUrls,
                  updatedAt: new Date(),
                },
              },
            );
          } else if (rewrittenCount < 5) {
            console.log(`\n${location.name}`);
            console.log(markdown);
          }

          rewrittenCount += 1;
          cleanedLinkCount += removedLinkCount > 0 ? 1 : 0;
        } catch (error) {
          failedCount += 1;
          console.error(`Failed ${location.name}: ${error.message}`);
        }
      }),
    ),
  );

  console.log("\nRewrite complete");
  console.log(`Rewritten: ${rewrittenCount}`);
  console.log(`Locations with DoggyDating links removed: ${cleanedLinkCount}`);
  console.log(`Failed: ${failedCount}`);

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to write changes.");
  }
} finally {
  await client.close();
}
