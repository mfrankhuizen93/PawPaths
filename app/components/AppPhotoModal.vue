<script lang="ts" setup>
import type { LocationPhoto } from "#shared/types/locations";

const model = defineModel({
  type: Object as PropType<LocationPhoto>,
});
</script>

<template>
  <UModal v-model:open="model" :title="model?.alt" fullscreen>
    <template #body>
      <div class="flex h-full flex-col items-center justify-center">
        <NuxtImg
          :alt="model.alt"
          :height="model.height"
          :src="model.url"
          :width="model.width"
          class="rounded-md object-contain"
          loading="lazy"
        />
      </div>
    </template>
  </UModal>
</template>

<style scoped></style>
