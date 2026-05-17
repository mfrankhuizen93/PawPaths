type LocationRouteInput =
  | string
  | {
      slug?: string | null;
      name?: string | null;
      city?: string | null;
    };

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getLocationNameSlug(name: string) {
  return slugify(name);
}

export function getLocationSlug(location: LocationRouteInput) {
  if (typeof location === "string") return getLocationNameSlug(location);

  if (location.slug) return location.slug;

  return slugify([location.name, location.city].filter(Boolean).join("-"));
}

export function getLocationPath(location: LocationRouteInput) {
  return `/location/${getLocationSlug(location)}`;
}
