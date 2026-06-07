<script setup lang="ts">
import type {
  EditableLocationFields,
  LocationContribution,
} from "#shared/types/locations";
import CommunitySubmissionDrawerSkeleton from "~/components/community/CommunitySubmissionDrawerSkeleton.vue";
import CommunitySubmissionStatusBadge from "~/components/community/CommunitySubmissionStatusBadge.vue";
import AppDrawer from "~/components/drawer/AppDrawer.vue";
import AppDrawerHeader from "~/components/drawer/AppDrawerHeader.vue";

const props = defineProps<{
  open: boolean;
  submission: LocationContribution | null;
  edit: EditableLocationFields | null;
  reviewing?: boolean;
  reviewingAction?: "approve" | "reject" | "save" | "";
  canGenerateDescription?: boolean;
}>();

const emit = defineEmits<{
  "update:open": [open: boolean];
  "update:edit": [edit: EditableLocationFields];
  approve: [submission: LocationContribution];
  reject: [submission: LocationContribution];
  save: [submission: LocationContribution];
}>();

const editablePayload = computed({
  get: () => props.edit,
  set: (edit) => {
    if (edit) emit("update:edit", edit);
  },
});

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
</script>

<template>
  <AppDrawer
    :description="submission?.submitter.email"
    :open="open"
    :title="submission?.payload.name"
    @update:open="$emit('update:open', $event)"
  >
    <template v-if="submission" #header>
      <AppDrawerHeader
        :description="`Submitted by ${submission.submitter.name}`"
        eyebrow="Community submission"
        :title="submission.payload.name"
      >
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <CommunitySubmissionStatusBadge :kind="submission.kind" />
          <span class="text-muted text-xs">
            {{ formatDate(submission.createdAt) }}
          </span>
        </div>
      </AppDrawerHeader>
    </template>

    <CommunitySubmissionDrawerSkeleton v-if="!submission || !editablePayload" />

    <AppLocationForm
      v-else
      v-model="editablePayload"
      :can-generate-description="canGenerateDescription"
      point-help="Check and adjust the location points before approving."
      :show-submit="false"
      @submit="$emit('save', submission)"
    >
      <template #actions>
        <div class="flex flex-wrap gap-2">
          <UButton
            color="success"
            icon="i-lucide-check"
            label="Approve"
            :loading="reviewing && reviewingAction === 'approve'"
            type="button"
            @click="$emit('approve', submission)"
          />
          <UButton
            color="neutral"
            icon="i-lucide-save"
            label="Save"
            :loading="reviewing && reviewingAction === 'save'"
            type="button"
            variant="subtle"
            @click="$emit('save', submission)"
          />
          <UButton
            color="error"
            icon="i-lucide-x"
            label="Reject"
            :loading="reviewing && reviewingAction === 'reject'"
            type="button"
            variant="subtle"
            @click="$emit('reject', submission)"
          />
        </div>
      </template>
    </AppLocationForm>
  </AppDrawer>
</template>
