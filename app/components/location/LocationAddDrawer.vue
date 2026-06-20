<script setup lang="ts">
import AppDrawer from "~/components/drawer/AppDrawer.vue";
import AppDrawerActions from "~/components/drawer/AppDrawerActions.vue";
import AppDrawerHeader from "~/components/drawer/AppDrawerHeader.vue";
import LocationAddForm from "~/components/location/LocationAddForm.vue";

const open = useAddLocationDrawer();
const dirty = ref(false);
</script>

<template>
  <AppDrawer
    v-model:open="open"
    :dirty="dirty"
    full-height
    title="Add a location"
  >
    <template #header>
      <AppDrawerHeader
        description="New places are reviewed before they appear on the map."
        eyebrow="Community"
        title="Add a location"
      />
    </template>

    <LocationAddForm
      :contained="false"
      @dirty-change="dirty = $event"
      @submitted="dirty = false"
    />

    <template #actions="{ close }">
      <AppDrawerActions>
        <UButton
          color="neutral"
          label="Cancel"
          type="button"
          variant="subtle"
          @click="close"
        />
        <UButton
          form="location-add-form"
          icon="i-lucide-send"
          label="Submit"
          type="submit"
        />
      </AppDrawerActions>
    </template>
  </AppDrawer>
</template>
