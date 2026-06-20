export const locationDescriptionTemplate = `**What makes this location unique?**
…

**What are the off-leash rules?**
…

**What is the terrain and environment like?**
…

**What local tips would you share?**
Think parking, quieter times, facilities, footwear, or nearby dog-friendly stops.
…`;

export const locationDescriptionSectionLabels = [
  "**What makes this location unique?**",
  "**Off-leash rules**",
  "**Terrain & environment**",
  "**Local tips**",
] as const;

export function isLocationDescriptionTemplate(value: unknown) {
  return String(value ?? "").trim() === locationDescriptionTemplate;
}
