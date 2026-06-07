export const locationDescriptionTemplate = `## What makes this location unique?
Describe the main reason someone would choose this location over another.

## Off-leash rules
Explain where and when dogs may be off leash, including any seasonal rules or restrictions.

## Terrain & environment
Describe the paths, landscape, route length, accessibility, and what the walk feels like.

## Water access
Explain whether dogs can safely reach or swim in water.

## Safety considerations
Mention roads, livestock, wildlife, cyclists, water quality, fencing, or other risks.

## Local tips
Share practical advice about parking, busy times, facilities, footwear, or nearby dog-friendly stops.`;

export const locationDescriptionHeadings = [
  "## What makes this location unique?",
  "## Off-leash rules",
  "## Terrain & environment",
  "## Water access",
  "## Safety considerations",
  "## Local tips",
] as const;

export function isLocationDescriptionTemplate(value: unknown) {
  return String(value ?? "").trim() === locationDescriptionTemplate;
}
