<script setup lang="ts">
import type { LocationCoordinatePoint } from "#shared/types/locations";
import {
  getLocationNavigationUrl,
  getNavigationDestinationOptions,
} from "#shared/utils/location-navigation";
import AppDrawer from "~/components/drawer/AppDrawer.vue";
import AppEmptyState from "~/components/common/AppEmptyState.vue";

const props = withDefaults(
  defineProps<{
    points?: LocationCoordinatePoint[];
    generalLocation?: { latitude?: number | null; longitude?: number | null };
  }>(),
  { points: () => [] },
);
const { user } = useAuth();
const open = ref(false);
const selectedId = ref<string>();
const appleDevice = ref(false);
const options = computed(() => getNavigationDestinationOptions(props.points));
const directUrl = computed(() =>
  options.value.length <= 1
    ? getLocationNavigationUrl(
        props.points,
        options.value[0]?.value ?? null,
        user.value?.navigationAppPreference ?? "device",
        appleDevice.value,
        props.generalLocation,
      )
    : undefined,
);
const url = computed(() =>
  getLocationNavigationUrl(
    props.points,
    selectedId.value ?? null,
    user.value?.navigationAppPreference ?? "device",
    appleDevice.value,
  ),
);
const fallbackUrl = computed(() =>
  getLocationNavigationUrl(props.points, selectedId.value ?? null, "google"),
);

watch(open, () => {
  selectedId.value = undefined;
});
watch(options, (items) => {
  if (!items.some((item) => item.value === selectedId.value))
    selectedId.value = undefined;
});
onMounted(() => {
  appleDevice.value = /Mac|iPhone|iPad|iPod/.test(navigator.platform);
});
</script>

<template>
  <UButton
    class="self-start"
    type="button"
    color="primary"
    icon="i-lucide-navigation"
    label="Navigate"
    variant="soft"
    :to="directUrl"
    :target="directUrl ? '_blank' : undefined"
    :rel="directUrl ? 'noopener noreferrer' : undefined"
    @click="!directUrl && (open = true)"
  />
  <AppDrawer
    v-model:open="open"
    title="Choose a destination"
    description="Select a recorded entrance or parking point for navigation."
  >
    <UFormField v-if="options.length" label="Destination">
      <USelect
        v-model="selectedId"
        :items="options"
        placeholder="Choose an entrance or parking point"
        class="w-full"
        :ui="{ base: 'text-base' }"
      />
    </UFormField>
    <AppEmptyState
      v-else
      title="No navigation destinations"
      description="No valid entrance, parking point, or general location has been recorded. Check the location's links for access information or suggest a location."
      icon="i-lucide-map-pin-off"
    />
    <template v-if="options.length" #actions>
      <div class="flex flex-col items-start gap-3">
        <UButton
          :disabled="!url"
          :to="url"
          target="_blank"
          rel="noopener noreferrer"
          icon="i-lucide-navigation"
          label="Open navigation"
        />
        <UButton
          v-if="url && url !== fallbackUrl"
          :to="fallbackUrl"
          target="_blank"
          rel="noopener noreferrer"
          color="neutral"
          variant="link"
          label="App unavailable? Open in Google Maps"
        />
      </div>
    </template>
  </AppDrawer>
</template>
