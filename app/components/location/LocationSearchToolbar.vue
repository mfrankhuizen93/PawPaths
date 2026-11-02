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
  <div class="border-default bg-default relative z-20 shrink-0 border-b pb-3">
    <AppPageToolbar compact>
      <template #primary>
        <UInput
          v-model="searchText"
          aria-label="Search locations by name or area"
          placeholder="Name or area"
          icon="i-lucide-search"
          class="w-full"
          :ui="{ base: 'h-10 text-base' }"
        />
      </template>
    </AppPageToolbar>
    <div class="mx-auto mt-3 flex max-w-5xl flex-col gap-2 px-4 sm:px-6">
      <div class="flex items-center justify-between gap-3">
        <div
          class="flex shrink-0 gap-1"
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
            class="h-10 justify-center"
            size="lg"
            @click="mode = view"
          />
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <UChip :show="filterCount > 0" :text="filterCount" size="lg">
            <UButton
              aria-label="Filter locations"
              :aria-expanded="filterOpen"
              :aria-description="`${filterCount} active filters`"
              label="Filters"
              :ui="{ label: 'hidden sm:inline' }"
              class="h-10 min-w-10 justify-center"
              size="lg"
              icon="i-lucide-sliders-horizontal"
              color="neutral"
              variant="soft"
              @click="filterOpen = true"
            />
          </UChip>
          <UButton
            aria-label="Add location"
            label="Add location"
            :ui="{ label: 'hidden sm:inline' }"
            class="h-10 min-w-10 justify-center"
            size="lg"
            icon="i-lucide-plus"
            color="neutral"
            variant="soft"
            @click="$emit('add')"
          />
        </div>
      </div>
      <p class="text-muted text-sm" role="status">
        {{ resultCount }}
        {{ resultCount === 1 ? "location" : "locations" }} shown{{
          truncated ? " · Zoom in for more" : ""
        }}
      </p>
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
