<script setup lang="ts">
import AppSkeletonCard from "~/components/common/AppSkeletonCard.vue";
</script>

<template>
  <div class="grid gap-3">
    <AppSkeletonCard v-for="item in 3" :key="item" />
  </div>
</template>
