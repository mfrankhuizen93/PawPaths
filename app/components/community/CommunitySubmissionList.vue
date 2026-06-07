<script setup lang="ts">
import type { LocationContribution } from "#shared/types/locations";
import AppEmptyState from "~/components/common/AppEmptyState.vue";
import CommunitySubmissionListSkeleton from "~/components/community/CommunitySubmissionListSkeleton.vue";
import CommunitySubmissionStatusBadge from "~/components/community/CommunitySubmissionStatusBadge.vue";

defineProps<{
  submissions: LocationContribution[];
  loading?: boolean;
}>();

defineEmits<{
  select: [submission: LocationContribution];
}>();

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
</script>

<template>
  <CommunitySubmissionListSkeleton v-if="loading" />

  <AppEmptyState
    v-else-if="submissions.length === 0"
    description="New location additions and suggested edits will appear here."
    icon="i-lucide-circle-check"
    title="No pending submissions"
  />

  <div v-else class="grid gap-3">
    <UCard
      v-for="submission in submissions"
      :key="submission.id"
      :ui="{ body: 'p-0 sm:p-0' }"
    >
      <button
        class="hover:bg-elevated focus-visible:outline-primary flex w-full flex-col gap-3 p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] sm:flex-row sm:items-center sm:justify-between"
        type="button"
        @click="$emit('select', submission)"
      >
        <span class="min-w-0">
          <span class="flex flex-wrap items-center gap-2">
            <CommunitySubmissionStatusBadge :kind="submission.kind" />
            <span class="text-highlighted font-semibold">
              {{ submission.payload.name }}
            </span>
          </span>
          <span class="text-muted mt-2 block text-sm">
            Submitted by {{ submission.submitter.name }} for
            {{ submission.locationName || submission.payload.city }}
          </span>
          <span class="text-dimmed mt-1 block text-xs">
            {{ formatDate(submission.createdAt) }}
          </span>
        </span>

        <span class="text-muted flex shrink-0 items-center gap-2 text-sm">
          Review
          <UIcon class="size-4" name="i-lucide-chevron-right" />
        </span>
      </button>
    </UCard>
  </div>
</template>
