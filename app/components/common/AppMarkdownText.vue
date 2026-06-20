<script lang="ts" setup>
import { parseMarkdownText } from "#shared/utils/markdown-text";
import AppMarkdownInline from "~/components/common/AppMarkdownInline.vue";

const props = withDefaults(
  defineProps<{
    content?: string | null;
  }>(),
  {
    content: "",
  },
);

const blocks = computed(() => parseMarkdownText(props.content ?? ""));
</script>

<template>
  <div class="space-y-3">
    <template v-for="(block, blockIndex) in blocks" :key="blockIndex">
      <ol
        v-if="block.type === 'list' && block.ordered"
        class="list-decimal space-y-1 pl-5"
      >
        <li v-for="(item, itemIndex) in block.items" :key="itemIndex">
          <AppMarkdownInline :nodes="item" />
        </li>
      </ol>
      <ul
        v-else-if="block.type === 'list'"
        class="list-disc space-y-1 pl-5"
      >
        <li v-for="(item, itemIndex) in block.items" :key="itemIndex">
          <AppMarkdownInline :nodes="item" />
        </li>
      </ul>
      <p v-else class="whitespace-pre-line leading-6">
        <AppMarkdownInline :nodes="block.children" />
      </p>
    </template>
  </div>
</template>
