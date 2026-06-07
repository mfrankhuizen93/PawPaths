<script setup lang="ts">
import type { UserRole } from "#shared/types/auth";

defineProps<{
  role: UserRole;
}>();

const labels: Record<UserRole, string> = {
  user: "User",
  maintainer: "Maintainer",
  admin: "Administrator",
};
</script>

<template>
  <UBadge color="neutral" variant="soft">
    {{ labels[role] }}
  </UBadge>
</template>
