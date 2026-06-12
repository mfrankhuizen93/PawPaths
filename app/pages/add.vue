<script lang="ts" setup>
import AppPageHeader from "~/components/common/AppPageHeader.vue";
import AppPageToolbar from "~/components/common/AppPageToolbar.vue";
import LocationAddForm from "~/components/location/LocationAddForm.vue";
</script>

<template>
  <AppPageToolbar />

  <div class="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
    <AppPageHeader
      description="New places are reviewed by maintainers before they appear on the map."
      eyebrow="Community"
      title="Add a location"
    />

    <LocationAddForm :contained="false" />
  </div>
</template>
