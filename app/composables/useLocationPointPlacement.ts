import { computed, ref } from "vue";
import type {
  EditableLocationFields,
  LocationCoordinateKind,
} from "#shared/types/locations";
import {
  roundLocationCoordinates,
  type LocationCoordinates,
} from "#shared/utils/location-coordinates";

type PlacementTarget =
  | { type: "area" }
  | { type: "point"; id: string }
  | {
      type: "new";
      kind: Exclude<LocationCoordinateKind, "general">;
      label: string;
    };

export function useLocationPointPlacement(
  getForm: () => EditableLocationFields,
) {
  const target = ref<PlacementTarget | null>(null);
  const draft = ref<LocationCoordinates | null>(null);
  const coordinates = computed(() => {
    if (draft.value) return draft.value;
    if (target.value?.type === "area") return getForm();
    if (target.value?.type === "point") {
      const id = target.value.id;
      return (
        getForm().coordinatePoints?.find((point) => point.id === id) ?? null
      );
    }
    return null;
  });

  function begin(next: PlacementTarget) {
    draft.value = null;
    target.value = next;
  }

  function cancel() {
    draft.value = null;
    target.value = null;
  }

  function pick(value: LocationCoordinates) {
    if (!target.value) return;
    draft.value = roundLocationCoordinates(value);
  }

  function confirm() {
    const destination = target.value;
    const value = draft.value;
    if (!destination || !value) return false;
    const form = getForm();
    if (destination.type === "area") {
      Object.assign(form, value);
    } else if (destination.type === "point") {
      const point = form.coordinatePoints?.find(
        (point) => point.id === destination.id,
      );
      // A stale selection can never write to the area or another point.
      if (!point) return false;
      Object.assign(point, value);
    } else {
      if ((form.coordinatePoints?.length ?? 0) >= 8) return false;
      form.coordinatePoints = [
        ...(form.coordinatePoints ?? []),
        {
          id: globalThis.crypto.randomUUID(),
          kind: destination.kind,
          label: destination.label,
          ...value,
        },
      ];
    }
    cancel();
    return true;
  }

  return { target, draft, coordinates, begin, pick, confirm, cancel };
}
