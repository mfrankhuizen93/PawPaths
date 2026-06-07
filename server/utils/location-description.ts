import { createError } from "h3";
import type { EditableLocationFields } from "#shared/types/locations";
import {
  isLocationDescriptionTemplate,
  locationDescriptionSectionLabels,
} from "#shared/utils/location-description";

const MAX_DESCRIPTION_LENGTH = 6_000;

type OpenAIResponse = {
  output_text?: string;
  output?: {
    content?: {
      text?: string;
    }[];
  }[];
};

function cleanText(value: unknown, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanList(value: unknown) {
  return Array.isArray(value)
    ? value
        .map((item) => cleanText(item, 100))
        .filter(Boolean)
        .slice(0, 20)
    : [];
}

function getOutputText(data: OpenAIResponse) {
  if (typeof data.output_text === "string") return data.output_text;

  return (data.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .filter((text): text is string => typeof text === "string")
    .join("");
}

function validateDescription(markdown: unknown) {
  const description = cleanText(markdown, MAX_DESCRIPTION_LENGTH);

  if (!description) {
    throw new Error("OpenAI returned an empty description.");
  }

  if (/<\/?[a-z][\s\S]*>/i.test(description)) {
    throw new Error("OpenAI returned HTML instead of Markdown.");
  }

  let previousLabelIndex = -1;

  for (const label of locationDescriptionSectionLabels) {
    const labelIndex = description.indexOf(label);

    if (labelIndex <= previousLabelIndex) {
      throw new Error("OpenAI returned an invalid description structure.");
    }

    previousLabelIndex = labelIndex;
  }

  return description;
}

function buildInput(location: Partial<EditableLocationFields>) {
  const existingDescription = cleanText(
    location.description,
    MAX_DESCRIPTION_LENGTH,
  );

  return {
    name: cleanText(location.name, 120),
    city: cleanText(location.city, 120),
    province: cleanText(location.province, 120),
    country: cleanText(location.country, 120),
    type: cleanList(location.type),
    characteristics: cleanList(location.characteristics),
    coordinatePoints: Array.isArray(location.coordinatePoints)
      ? location.coordinatePoints.slice(0, 8).map((point) => ({
          kind: cleanText(point?.kind, 40),
          label: cleanText(point?.label, 120),
        }))
      : [],
    relatedUrls: Array.isArray(location.relatedUrls)
      ? location.relatedUrls.slice(0, 5).map((item) => ({
          label: cleanText(item?.label, 80),
          url: cleanText(item?.url, 500),
        }))
      : [],
    existingDescription:
      existingDescription && !isLocationDescriptionTemplate(existingDescription)
        ? existingDescription
        : "",
  };
}

export async function generateLocationDescription(
  location: Partial<EditableLocationFields>,
  options: {
    apiKey?: string;
    model?: string;
    fetcher?: typeof fetch;
  } = {},
) {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  const model =
    options.model ?? process.env.OPENAI_DESCRIPTION_MODEL ?? "gpt-4.1-mini";
  const fetcher = options.fetcher ?? fetch;

  if (!apiKey) {
    throw createError({
      statusCode: 503,
      statusMessage: "Description generation is not configured.",
    });
  }

  const response = await fetcher("https://api.openai.com/v1/responses", {
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
          content: [
            "You write concise location descriptions for dog owners.",
            "Write only in natural English and use Markdown.",
            "Use exactly the six required bold section labels, in the supplied order.",
            "Under each label, write one short paragraph or a compact bullet list.",
            "Prioritize practical facts and what makes the location worth choosing.",
            "Take the existing description into account, but reorganize and improve it.",
            "Do not invent facts or infer rules from the location type.",
            'When information for a section is missing, write "Details have not been provided yet."',
            "Do not add a title, introduction, conclusion, links, or HTML.",
          ].join(" "),
        },
        {
          role: "user",
          content: `Create the description from this location data:\n${JSON.stringify(
            buildInput(location),
            null,
            2,
          )}\n\nRequired bold section labels:\n${locationDescriptionSectionLabels.join("\n")}`,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "location_description",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              markdown: { type: "string" },
            },
            required: ["markdown"],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    throw createError({
      statusCode: 502,
      statusMessage: "OpenAI could not generate a description.",
    });
  }

  try {
    const outputText = getOutputText((await response.json()) as OpenAIResponse);
    const parsed = JSON.parse(outputText) as { markdown?: unknown };

    return validateDescription(parsed.markdown);
  } catch (error) {
    if ("statusCode" in Object(error)) throw error;

    throw createError({
      statusCode: 502,
      statusMessage: "OpenAI returned an invalid description.",
    });
  }
}
