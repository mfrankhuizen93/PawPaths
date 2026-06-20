<script lang="ts" setup>
import type { GeocodeResult } from "#shared/types/geo";

const props = withDefaults(
  defineProps<{
    placeholder?: string;
    autofocus?: boolean;
    collapsible?: boolean;
    size?: "sm" | "md" | "lg" | "xl";
  }>(),
  {
    placeholder: "Search address or place",
    autofocus: false,
    collapsible: false,
    size: "lg",
  },
);

const emit = defineEmits<{
  close: [];
  selected: [result: GeocodeResult];
}>();

const query = ref("");
const results = ref<GeocodeResult[]>([]);
const isSearching = ref(false);
const error = ref("");
let searchTimer: ReturnType<typeof window.setTimeout> | null = null;
let ignoreNextQueryChange = false;

async function searchAddress() {
  const searchQuery = query.value.trim();

  error.value = "";
  results.value = [];

  if (searchQuery.length < 3) {
    return;
  }

  isSearching.value = true;

  try {
    results.value = await $fetch<GeocodeResult[]>("/api/geo/search", {
      query: { q: searchQuery },
    });

    if (results.value.length === 0) {
      error.value = "No address found.";
    }
  } catch {
    error.value = "Could not search for that address.";
  } finally {
    isSearching.value = false;
  }
}

function queueSearch() {
  if (ignoreNextQueryChange) {
    ignoreNextQueryChange = false;
    return;
  }

  if (searchTimer) {
    window.clearTimeout(searchTimer);
    searchTimer = null;
  }

  error.value = "";
  results.value = [];

  const searchQuery = query.value.trim();

  if (searchQuery.length < 3) {
    isSearching.value = false;
    return;
  }

  searchTimer = window.setTimeout(() => {
    void searchAddress();
  }, 450);
}

function selectResult(result: GeocodeResult) {
  ignoreNextQueryChange = true;
  query.value = result.label;
  results.value = [];
  error.value = "";
  emit("selected", result);
}

watch(query, queueSearch);

onBeforeUnmount(() => {
  if (searchTimer) {
    window.clearTimeout(searchTimer);
  }
});
</script>

<template>
  <div class="relative flex flex-col">
    <UInput
      v-model="query"
      :autofocus="props.autofocus"
      :loading="isSearching"
      :placeholder="props.placeholder"
      class="min-w-0 flex-1"
      icon="i-lucide-search"
      :size="props.size"
      :ui="{ base: props.size === 'lg' ? 'h-12' : undefined }"
      variant="none"
    >
      <template v-if="props.collapsible" #trailing>
        <UButton
          aria-label="Close search"
          color="neutral"
          icon="i-lucide-x"
          size="sm"
          square
          variant="ghost"
          @click="emit('close')"
        />
      </template>
    </UInput>

    <div
      v-if="results.length"
      class="border-default bg-default absolute top-[calc(100%+0.75rem)] left-0 w-full overflow-hidden rounded-2xl border shadow-xl"
    >
      <button
        v-for="result in results"
        :key="result.id"
        class="border-default hover:bg-elevated flex w-full items-start gap-3 border-b px-4 py-3 text-left text-sm last:border-b-0"
        type="button"
        @click="selectResult(result)"
      >
        <span
          class="bg-primary/10 text-primary grid size-8 shrink-0 place-items-center rounded-full"
        >
          <UIcon name="i-lucide-map-pin" />
        </span>
        <span class="text-highlighted min-w-0 py-1 leading-5">
          {{ result.label }}
        </span>
      </button>
    </div>

    <p
      v-if="error"
      class="bg-default border-default text-error absolute top-[calc(100%+0.75rem)] left-0 w-full rounded-xl border px-3 py-2 text-sm font-medium shadow-lg"
    >
      {{ error }}
    </p>
  </div>
</template>
