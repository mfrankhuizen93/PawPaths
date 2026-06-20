import type { EditableLocationFields } from "#shared/types/locations";

export function normalizeEditableLocationFields(
  payload: Partial<EditableLocationFields> | null | undefined,
): EditableLocationFields {
  return {
    name: payload?.name ?? "",
    city: payload?.city ?? "",
    province: payload?.province ?? "",
    country: payload?.country ?? "Netherlands",
    latitude: payload?.latitude ?? null,
    longitude: payload?.longitude ?? null,
    type: [...(payload?.type ?? [])],
    characteristics: [...(payload?.characteristics ?? [])],
    description: payload?.description ?? "",
    relatedUrls: (payload?.relatedUrls ?? []).map((url) => ({ ...url })),
    photos: (payload?.photos ?? []).map((photo) => ({ ...photo })),
    coordinatePoints: (payload?.coordinatePoints ?? []).map((point) => ({
      ...point,
    })),
  };
}
