<script lang="ts" setup>
import type { LocationPhoto } from "#shared/types/locations";

defineProps({
  photos: {
    type: Array as PropType<LocationPhoto[]>,
  },
});
</script>

<template>
  <div class="app-photo-lanes__container">
    <div class="app-photo-lanes">
      <NuxtImg
        v-for="photo in photos"
        :key="photo.url"
        :alt="photo.alt"
        :src="photo.url"
        class="h-full w-full object-cover"
      />
    </div>
  </div>
</template>

<style scoped>
.app-photo-lanes {
  @apply grid w-max grid-flow-col gap-4;
}
.app-photo-lanes__container {
  @apply w-full overflow-x-auto;
}

img {
  @apply w-32 rounded;
  @apply row-span-1;
}

img:nth-child(3n + 1) {
  @apply row-span-2;
}
</style>
