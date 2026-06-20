<script lang="ts" setup>
import type { MarkdownTextInline } from "#shared/utils/markdown-text";

defineProps<{
  nodes: MarkdownTextInline[];
}>();
</script>

<template>
  <template v-for="(node, index) in nodes" :key="index">
    <strong v-if="node.type === 'strong'" class="font-semibold text-slate-950">
      {{ node.text }}
    </strong>
    <em v-else-if="node.type === 'emphasis'">
      {{ node.text }}
    </em>
    <s v-else-if="node.type === 'strike'">
      {{ node.text }}
    </s>
    <NuxtLink
      v-else-if="node.type === 'link'"
      :to="node.href"
      class="text-primary underline-offset-4 hover:underline"
      external
      target="_blank"
      rel="noopener noreferrer"
    >
      {{ node.text }}
    </NuxtLink>
    <span v-else>{{ node.text }}</span>
  </template>
</template>
