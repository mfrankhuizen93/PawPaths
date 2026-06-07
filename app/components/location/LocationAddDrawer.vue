<script setup lang="ts">
import AppDrawer from "~/components/drawer/AppDrawer.vue";
import AppDrawerHeader from "~/components/drawer/AppDrawerHeader.vue";
import LocationAddForm from "~/components/location/LocationAddForm.vue";

const open = useAddLocationDrawer();
</script>

<template>
  <AppDrawer v-model:open="open" title="Add a location">
    <template #header>
      <AppDrawerHeader
        description="New places are reviewed before they appear on the map."
        eyebrow="Community"
        title="Add a location"
      />
    </template>

    <LocationAddForm />
  </AppDrawer>
</template>
