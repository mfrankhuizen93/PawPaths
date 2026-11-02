<script setup lang="ts">
import LocationSearchCard from "./LocationSearchCard.vue";
import AppEmptyState from "~/components/common/AppEmptyState.vue";
import type { LocationListItem } from "#shared/types/locations";
import { useInfiniteScroll } from "@vueuse/core";
const props = defineProps<{
  locations: LocationListItem[];
  pending: boolean;
  more: boolean;
  loadingMore: boolean;
  loadMoreError: string;
  loadMore: () => Promise<void>;
}>();
defineEmits<{
  select: [location: LocationListItem];
  clear: [];
}>();
const scrollContainer = useTemplateRef<HTMLElement>("scrollContainer");
useInfiniteScroll(scrollContainer, () => props.loadMore(), {
  distance: 300,
  canLoadMore: () =>
    props.more && !props.pending && !props.loadingMore && !props.loadMoreError,
});
watch(
  () => props.pending,
  (pending) => {
    if (pending) scrollContainer.value?.scrollTo({ top: 0 });
  },
);
</script>
<template>
  <section
    ref="scrollContainer"
    aria-label="Search results"
    :aria-busy="pending || loadingMore"
    tabindex="0"
    class="h-full overflow-y-auto p-4 sm:p-6"
  >
    <div class="mx-auto flex max-w-3xl flex-col gap-3">
      <template v-if="!pending">
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
      </template>
      <p
        v-if="loadingMore"
        role="status"
        class="text-muted text-center text-sm"
      >
        Loading more locations…
      </p>
      <template v-if="pending || loadingMore">
        <div
          v-for="n in pending ? 5 : 2"
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
      <UAlert
        v-if="!pending && loadMoreError"
        :title="loadMoreError"
        color="warning"
        :actions="[{ label: 'Retry', onClick: loadMore }]"
      />
      <p
        v-else-if="!pending && !loadingMore && !more && locations.length"
        role="status"
        class="text-muted text-center text-sm"
      >
        All matching locations are shown.
      </p>
    </div>
  </section>
</template>
