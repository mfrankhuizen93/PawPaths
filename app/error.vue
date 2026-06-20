<script lang="ts" setup>
import type { NuxtError } from "#app";
import AppPageToolbar from "~/components/common/AppPageToolbar.vue";

defineProps<{
  error: NuxtError;
}>();
</script>

<template>
  <UApp>
    <AppPageToolbar />

    <UError :error="error" />
  </UApp>
</template>
