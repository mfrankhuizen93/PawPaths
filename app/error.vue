<script lang="ts" setup>
import type { NuxtError } from "#app";

defineProps<{ error: NuxtError }>();
</script>

<template>
  <div>
    <pre>{{ error }}</pre>
    <NuxtLink to="/">Go back home</NuxtLink>
  </div>
</template>
