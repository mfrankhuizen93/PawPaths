<script setup lang="ts">
import AppLocationFilters from "~/components/AppLocationFilters.vue";
import type { LocationFilters } from "#shared/types/locations";
import AppPageToolbar from "~/components/common/AppPageToolbar.vue";
const filters = defineModel<LocationFilters>({ required: true });
const mode = defineModel<"map" | "list">("mode", { required: true });
defineProps<{ resultCount: number; total: number; truncated?: boolean }>();
defineEmits<{ add: [] }>();
const filterOpen = ref(false);
const searchText = ref(filters.value.q ?? "");
watch(searchText, (q) => {
  filters.value = { ...filters.value, q: q || undefined };
});
watch(
  () => filters.value.q,
  (q) => {
    if ((q ?? "") !== searchText.value.trim()) searchText.value = q ?? "";
  },
);
const filterCount = computed(
  () =>
    Object.entries(filters.value).filter(
      ([key, value]) =>
        !["q", "lat", "lng"].includes(key) &&
        value !== undefined &&
        (!Array.isArray(value) || value.length),
    ).length,
);
</script>

<template>
  <div class="bg-default relative z-20 shrink-0 border-b pb-3">
    <AppPageToolbar>
      <template #primary>
        <UInput
          v-model="searchText"
          aria-label="Search locations by name or area"
          placeholder="Name or area"
          icon="i-lucide-search"
          class="w-full"
          :ui="{ base: 'text-base' }"
        />
      </template>
      <template #actions>
        <UButton
          aria-label="Filter locations"
          :aria-expanded="filterOpen"
          :aria-description="`${filterCount} active filters`"
          :label="filterCount ? String(filterCount) : undefined"
          icon="i-lucide-sliders-horizontal"
          color="neutral"
          variant="soft"
          @click="filterOpen = true"
        />
        <UButton
          aria-label="Add location"
          icon="i-lucide-plus"
          color="neutral"
          variant="soft"
          @click="$emit('add')"
        />
      </template>
    </AppPageToolbar>
    <div
      class="mx-auto mt-3 flex max-w-5xl gap-2 px-4 sm:px-6"
      role="group"
      aria-label="Search presentation"
    >
      <UButton
        v-for="view in ['map', 'list'] as const"
        :key="view"
        :label="view === 'map' ? 'Map' : 'List'"
        :icon="view === 'map' ? 'i-lucide-map' : 'i-lucide-list'"
        :aria-pressed="mode === view"
        :variant="mode === view ? 'solid' : 'soft'"
        @click="mode = view"
      />
      <span class="text-muted my-auto text-sm" role="status"
        >{{ resultCount }} locations shown{{
          truncated ? " · Zoom in for more" : ""
        }}</span
      >
    </div>
    <UDrawer
      v-model:open="filterOpen"
      title="Filters"
      description="Choose recorded characteristics, facilities, hazards, rating, and distance."
      direction="bottom"
      :ui="{
        content: 'max-h-[90dvh]',
        body: 'overflow-y-auto',
        container: 'mx-auto w-full max-w-3xl',
      }"
    >
      <template #body
        ><AppLocationFilters
          v-model="filters"
          :result-count="resultCount"
          :total="total"
      /></template>
    </UDrawer>
  </div>
</template>
