<script lang="ts" setup>
import type { LocationPhoto } from "#shared/types/locations";

const open = defineModel({
  type: Boolean,
});

defineProps({
  locationName: {
    type: String,
    required: true,
  },
  photos: {
    type: Array as PropType<LocationPhoto[]>,
    default: () => [],
  },
  index: {
    type: Number,
    default: 0,
  },
});
</script>

<template>
  <UModal v-model:open="open" :title="`Photo of ${locationName}`" fullscreen>
    <template #body>
      <UCarousel
        v-slot="{ item }"
        :items="photos"
        :start-index="index"
        dots
        loop
      >
        <NuxtImg
          :alt="item.alt"
          :height="item.height"
          :src="item.url"
          :width="item.width"
          class="h-full rounded-md object-contain"
          loading="lazy"
        />
      </UCarousel>
    </template>
  </UModal>
</template>

<style scoped></style>
