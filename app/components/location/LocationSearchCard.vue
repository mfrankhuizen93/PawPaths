<script setup lang="ts">
import type { LocationListItem } from "#shared/types/locations";
defineProps<{ location: LocationListItem; preview?: boolean }>();
defineEmits<{ select: [location: LocationListItem] }>();
</script>
<template>
  <article class="bg-default flex gap-3 rounded-lg border p-3">
    <img
      v-if="location.photos?.[0]?.url"
      :src="location.photos[0].url"
      :alt="location.photos[0].alt || ''"
      class="size-20 shrink-0 rounded-md object-cover"
      loading="lazy"
    />
    <div class="min-w-0 flex-1">
      <h2 class="text-highlighted font-semibold">{{ location.name }}</h2>
      <p class="text-muted text-sm">
        {{ [location.city, location.country].filter(Boolean).join(", ") }}
      </p>
      <p class="text-muted text-sm">
        {{
          location.averageRating == null
            ? "Unrated"
            : `${location.averageRating} / 5 · ${location.ratingCount} ratings`
        }}
      </p>
      <div class="my-2 flex flex-wrap gap-1">
        <UBadge
          v-for="feature in location.characteristics.slice(0, 2)"
          :key="feature"
          color="neutral"
          variant="soft"
          >{{ feature }}</UBadge
        >
      </div>
      <UButton
        :aria-label="`View ${location.name}`"
        :label="preview ? 'View details' : 'View location'"
        variant="soft"
        @click="$emit('select', location)"
      />
    </div>
  </article>
</template>
