<script lang="ts" setup>
import type { LocationDetail } from "#shared/types/locations";

const route = useRoute();
const router = useRouter();
const slug = computed(() => String(route.params.slug ?? ""));

const { data: location, error } = await useFetch<LocationDetail>(
  () => `/api/locations/${slug.value}`,
);

const locationTitle = computed(() => location.value?.name ?? "Location");
const locationMeta = computed(() =>
  [location.value?.city, location.value?.province, location.value?.country]
    .filter(Boolean)
    .join(", "),
);
const descriptionParts = computed(() =>
  (location.value?.description ?? "")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean),
);
const heroPhoto = computed(() => location.value?.photos?.[0]);

useSeoMeta({
  title: () => `${locationTitle.value} | PawPaths`,
  description: () =>
    location.value?.description?.replace(/\s+/g, " ").slice(0, 160) ??
    "Dog-friendly location details on PawPaths.",
});

function backToMap() {
  router.back();
}
</script>

<template>
  <UContainer class="flex flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
    <UButton
      class="self-start"
      color="neutral"
      icon="i-lucide-arrow-left"
      variant="ghost"
      @click="backToMap"
    >
      Back to map
    </UButton>

    <UAlert
      v-if="error"
      color="error"
      icon="i-lucide-circle-alert"
      title="Location not found"
      variant="soft"
    />

    <article v-else-if="location" class="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
      <div class="flex flex-col gap-6">
        <section
          class="overflow-hidden rounded-md border border-slate-200 bg-white"
        >
          <img
            v-if="heroPhoto"
            :alt="heroPhoto.alt || location.name"
            :src="heroPhoto.url"
            class="aspect-[16/9] w-full object-cover"
          />
          <div
            v-else
            class="flex aspect-[16/9] items-center justify-center bg-emerald-50 text-lg font-bold text-emerald-800"
          >
            PawPaths
          </div>
          <div class="flex flex-col gap-4 p-5">
            <div>
              <p class="text-brand-600 text-sm font-semibold">Location</p>
              <h1 class="font-title text-3xl font-extrabold text-slate-950">
                {{ location.name }}
              </h1>
              <p v-if="locationMeta" class="text-slate-600">
                {{ locationMeta }}
              </p>
            </div>

            <div class="flex flex-wrap gap-2">
              <UBadge
                v-for="type in location.type"
                :key="type"
                color="primary"
                variant="soft"
              >
                {{ type }}
              </UBadge>
              <UBadge
                v-for="characteristic in location.characteristics"
                :key="characteristic"
                color="neutral"
                variant="soft"
              >
                {{ characteristic }}
              </UBadge>
            </div>
          </div>
        </section>

        <section class="rounded-md border border-slate-200 bg-white p-5">
          <h2 class="text-xl font-bold text-slate-950">Details</h2>
          <div class="mt-4 flex flex-col gap-4 text-slate-700">
            <p v-for="part in descriptionParts" :key="part">
              {{ part }}
            </p>
            <p v-if="descriptionParts.length === 0">
              No detailed description is available yet.
            </p>
          </div>
        </section>

        <section
          v-if="location.photos.length > 1"
          class="grid gap-3 sm:grid-cols-2"
        >
          <img
            v-for="photo in location.photos.slice(1, 5)"
            :key="photo.url"
            :alt="photo.alt || location.name"
            :src="photo.url"
            class="aspect-[4/3] rounded-md object-cover"
            loading="lazy"
          />
        </section>
      </div>

      <aside class="flex flex-col gap-4">
        <UCard>
          <div class="flex flex-col gap-3">
            <p class="text-sm font-semibold text-slate-500">Rating</p>
            <p class="text-2xl font-extrabold text-slate-950">
              <template v-if="location.averageRating != null">
                {{ location.averageRating }} / 5
              </template>
              <template v-else>No rating yet</template>
            </p>
            <p class="text-sm text-slate-600">
              {{ location.ratingCount }} ratings · {{ location.reviewCount }}
              reviews
            </p>
          </div>
        </UCard>

        <ClientOnly>
          <AppLocation
            :location="location"
            eyebrow="Map"
            title="Location"
            variant="single"
          />
        </ClientOnly>

        <UCard v-if="location.relatedUrls?.length">
          <div class="flex flex-col gap-3">
            <h2 class="text-lg font-bold text-slate-950">Links</h2>
            <UButton
              v-for="relatedUrl in location.relatedUrls"
              :key="relatedUrl.url"
              :to="relatedUrl.url"
              color="neutral"
              icon="i-lucide-external-link"
              target="_blank"
              variant="outline"
            >
              {{ relatedUrl.label }}
            </UButton>
          </div>
        </UCard>
      </aside>
    </article>
  </UContainer>
</template>
