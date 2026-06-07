<script setup lang="ts">
import type { LocationContributionKind } from "#shared/types/locations";

defineProps<{
  kind: LocationContributionKind;
}>();
</script>

<template>
  <UBadge color="neutral" variant="soft">
    {{ kind === "new-location" ? "New location" : "Location edit" }}
  </UBadge>
</template>
