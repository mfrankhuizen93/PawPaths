<script lang="ts" setup>
import type { LocationPhoto } from "#shared/types/locations";

defineProps({
  photos: {
    type: Array as PropType<LocationPhoto[]>,
  },
});

const selectedPhoto = ref<LocationPhoto | null>(null);
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
        @click="selectedPhoto = photo"
      />
    </div>

    <AppPhotoModal v-model="selectedPhoto" />
  </div>
</template>

<style scoped>
.app-photo-lanes {
  @apply grid w-max grid-flow-col gap-4;
  @apply auto-rows-[6rem];
}
.app-photo-lanes__container {
  @apply w-full overflow-x-auto;
}

img {
  @apply w-32 rounded-md;
  @apply row-span-1;
}

img:nth-child(3n + 1) {
  @apply row-span-2;
}
</style>
