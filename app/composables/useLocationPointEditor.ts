import { computed, ref } from "vue";
import type {
  EditableLocationFields,
  LocationCoordinateKind,
} from "#shared/types/locations";
import { locationCoordinateKindOptions } from "#shared/types/locations";

/** Every operation addresses a persisted identity, never a label or array index. */
export function useLocationPointEditor(
  getForm: () => EditableLocationFields,
  canEdit: () => boolean,
) {
  const selectedId = ref<string | null>(null);
  const removalId = ref<string | null>(null);
  const identityError = computed(() => {
    const ids = (getForm().coordinatePoints ?? []).map((point) => point.id);
    return (
      ids.some(
        (id) =>
          typeof id !== "string" ||
          !id.trim() ||
          id.trim() !== id ||
          id.length > 80,
      ) || new Set(ids).size !== ids.length
    );
  });
  const editable = computed(() => canEdit() && !identityError.value);
  const selectedPoint = computed(
    () =>
      getForm().coordinatePoints?.find(
        (point) => point.id === selectedId.value,
      ) ?? null,
  );
  const removalPoint = computed(
    () =>
      getForm().coordinatePoints?.find(
        (point) => point.id === removalId.value,
      ) ?? null,
  );
  function rename(label: string) {
    if (!editable.value || !selectedPoint.value || !label.trim()) return false;
    selectedPoint.value.label = label.trim().slice(0, 120);
    return true;
  }
  function changeKind(kind: LocationCoordinateKind) {
    if (
      !editable.value ||
      !selectedPoint.value ||
      kind === "general" ||
      !locationCoordinateKindOptions.some((option) => option.value === kind)
    )
      return false;
    selectedPoint.value.kind = kind;
    return true;
  }
  function requestRemoval(id: string) {
    if (
      !editable.value ||
      !getForm().coordinatePoints?.some((point) => point.id === id)
    )
      return false;
    removalId.value = id;
    return true;
  }
  function confirmRemoval() {
    if (!editable.value || !removalPoint.value) return false;
    const id = removalId.value;
    getForm().coordinatePoints = getForm().coordinatePoints?.filter(
      (point) => point.id !== id,
    );
    if (selectedId.value === id) selectedId.value = null;
    removalId.value = null;
    return true;
  }
  function reset() {
    selectedId.value = null;
    removalId.value = null;
  }
  return {
    selectedId,
    selectedPoint,
    removalId,
    removalPoint,
    identityError,
    editable,
    rename,
    changeKind,
    requestRemoval,
    confirmRemoval,
    reset,
  };
}
