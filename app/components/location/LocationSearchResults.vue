<script setup lang="ts">
import LocationSearchCard from "./LocationSearchCard.vue";
import AppEmptyState from "~/components/common/AppEmptyState.vue";
import type { LocationListItem } from "#shared/types/locations";
defineProps<{
  locations: LocationListItem[];
  pending: boolean;
  more: boolean;
  loadingMore: boolean;
}>();
defineEmits<{
  select: [location: LocationListItem];
  loadMore: [];
  clear: [];
}>();
</script>
<template>
  <section
    aria-label="Search results"
    :aria-busy="pending"
    class="h-full overflow-y-auto p-4 sm:p-6"
  >
    <div class="mx-auto flex max-w-3xl flex-col gap-3">
      <template v-if="pending">
        <div
          v-for="n in 5"
          :key="n"
          class="border-default flex items-center gap-3 rounded-lg border p-3"
        >
          <USkeleton class="size-20 shrink-0" />
          <div class="min-w-0 flex-1 space-y-2">
            <USkeleton class="h-6 w-full" />
            <USkeleton class="h-4 w-2/3" />
            <USkeleton class="h-4 w-1/2" />
            <USkeleton class="h-5 w-20" />
          </div>
          <USkeleton class="size-5 shrink-0" />
        </div>
      </template>
      <template v-else>
        <LocationSearchCard
          v-for="location in locations"
          :key="location.id"
          :location="location"
          @select="$emit('select', $event)"
        />
        <AppEmptyState
          v-if="!locations.length"
          title="No locations found"
          description="Try another name, area, or filters."
          icon="i-lucide-search-x"
          action-label="Clear search"
          @action="$emit('clear')"
        />
        <UButton
          v-if="more"
          label="Load more locations"
          class="self-center"
          :loading="loadingMore"
          @click="$emit('loadMore')"
        />
      </template>
    </div>
  </section>
</template>
