<script setup lang="ts">
import type { LocationListItem } from "#shared/types/locations";
defineProps<{ location: LocationListItem }>();
defineEmits<{ select: [location: LocationListItem] }>();
</script>

<template>
  <article>
    <UButton
      :aria-label="`View details for ${location.name}`"
      aria-haspopup="dialog"
      class="border-default bg-default hover:bg-elevated focus-visible:ring-primary w-full gap-3 rounded-lg border p-3 text-left whitespace-normal focus-visible:ring-2"
      color="neutral"
      variant="ghost"
      trailing-icon="i-lucide-chevron-right"
      :ui="{ trailingIcon: 'text-dimmed shrink-0' }"
      @click="$emit('select', location)"
    >
      <img
        v-if="location.photos?.[0]?.url"
        :src="location.photos[0].url"
        alt=""
        class="size-20 shrink-0 rounded-md object-cover"
        loading="lazy"
      />
      <span class="min-w-0 flex-1">
        <span class="text-highlighted block text-base font-semibold">{{
          location.name
        }}</span>
        <span class="text-muted block text-sm font-normal">
          {{ [location.city, location.country].filter(Boolean).join(", ") }}
        </span>
        <span class="text-muted block text-sm font-normal">
          {{
            location.averageRating == null
              ? "Unrated"
              : `${location.averageRating} / 5 · ${location.ratingCount} ratings`
          }}
        </span>
        <span
          v-if="location.characteristics.length"
          class="mt-2 flex flex-wrap gap-1"
        >
          <UBadge
            v-for="feature in location.characteristics.slice(0, 2)"
            :key="feature"
            color="neutral"
            variant="soft"
            >{{ feature }}</UBadge
          >
        </span>
      </span>
    </UButton>
  </article>
</template>
