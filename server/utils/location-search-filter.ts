import type { LocationFilters } from "../../shared/types/locations";

type Clause = Record<string, unknown>;
const attributeLegacy: Record<string, string> = {
  offLeash: "off-leash area",
  fenced: "fenced",
  swimming: "swimming water",
  wheelchairAccessible: "wheelchair accessible",
};
const characteristicAttributes: Record<string, string> = Object.fromEntries(
  Object.entries(attributeLegacy).map(([key, value]) => [value, key]),
);

/** Matches the same explicit-first semantics as normalizeAreaAttributes. */
export function attributeClause(key: string, value: string): Clause {
  const legacy = attributeLegacy[key];
  const states =
    key === "offLeash"
      ? ["everywhere", "partial", "not-allowed", "unknown"]
      : ["yes", "no", "unknown"];
  const legacyPositive = key === "offLeash" ? "partial" : "yes";
  const fallback: Clause[] = [{ [`attributes.${key}`]: { $nin: states } }];
  if (value === legacyPositive) fallback.push({ characteristics: legacy });
  else if (value === "unknown")
    fallback.push({ characteristics: { $ne: legacy } });
  else return { [`attributes.${key}`]: value };
  return { $or: [{ [`attributes.${key}`]: value }, { $and: fallback }] };
}

export function buildLocationSearchFilter(filters: LocationFilters): Clause {
  const clauses: Clause[] = [];
  for (const key of [
    "offLeash",
    "fenced",
    "swimming",
    "wheelchairAccessible",
  ] as const) {
    if (filters[key]) clauses.push(attributeClause(key, filters[key]));
  }
  if (filters.type?.length) clauses.push({ type: { $in: filters.type } });
  if (filters.excludeType?.length)
    clauses.push({
      type: { $exists: true, $ne: [], $nin: filters.excludeType },
    });
  for (const value of filters.characteristic ?? []) {
    const attribute = characteristicAttributes[value];
    clauses.push(
      attribute
        ? attribute === "offLeash"
          ? {
              $or: [
                attributeClause(attribute, "everywhere"),
                attributeClause(attribute, "partial"),
              ],
            }
          : attributeClause(attribute, "yes")
        : {
            $or: [
              { characteristics: value },
              ...(value === "food and drink"
                ? [{ "coordinatePoints.kind": "cafe" }]
                : []),
            ],
          },
    );
  }
  for (const value of filters.excludeCharacteristic ?? []) {
    const attribute = characteristicAttributes[value];
    // Legacy arrays and missing point collections cannot establish a negative.
    clauses.push(
      attribute
        ? attributeClause(
            attribute,
            attribute === "offLeash" ? "not-allowed" : "no",
          )
        : { $expr: { $eq: [1, 0] } },
    );
  }
  if (filters.parking) clauses.push({ "coordinatePoints.kind": "parking" });
  for (const facility of filters.facility ?? [])
    clauses.push({
      $or: [
        { "coordinatePoints.kind": facility },
        ...(facility === "cafe" ? [{ characteristics: "food and drink" }] : []),
      ],
    });
  for (const hazard of filters.hazard ?? [])
    clauses.push({
      $or: [
        { "coordinatePoints.kind": hazard },
        { warnings: hazard },
        { characteristics: hazard },
      ],
    });
  if (filters.q) {
    const pattern = new RegExp(
      filters.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    );
    clauses.push({
      $or: ["name", "city", "province", "country", "description"].map(
        (field) => ({ [field]: pattern }),
      ),
    });
  }
  return { status: "published", ...(clauses.length ? { $and: clauses } : {}) };
}
