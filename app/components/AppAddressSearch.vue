<script lang="ts" setup>
import type { GeocodeResult } from "#shared/types/geo";

const props = withDefaults(
  defineProps<{
    placeholder?: string;
  }>(),
  {
    placeholder: "Search address or place",
  },
);

const emit = defineEmits<{
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
  <div class="flex flex-col gap-2">
    <UInput
      v-model="query"
      :loading="isSearching"
      :placeholder="props.placeholder"
      class="min-w-0 flex-1"
      icon="i-lucide-search"
      size="md"
    />

    <div
      v-if="results.length"
      class="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm"
    >
      <button
        v-for="result in results"
        :key="result.id"
        class="hover:bg-brand-50 flex w-full items-start gap-2 border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0"
        type="button"
        @click="selectResult(result)"
      >
        <UIcon class="text-brand-600 mt-0.5 shrink-0" name="i-lucide-map-pin" />
        <span class="min-w-0 leading-5 text-slate-700">
          {{ result.label }}
        </span>
      </button>
    </div>

    <p v-if="error" class="text-xs font-medium text-red-700">
      {{ error }}
    </p>
  </div>
</template>
