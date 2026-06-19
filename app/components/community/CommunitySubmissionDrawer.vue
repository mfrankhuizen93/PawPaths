<script setup lang="ts">
import type {
  EditableLocationFields,
  LocationContribution,
} from "#shared/types/locations";
import CommunitySubmissionDrawerSkeleton from "~/components/community/CommunitySubmissionDrawerSkeleton.vue";
import CommunitySubmissionStatusBadge from "~/components/community/CommunitySubmissionStatusBadge.vue";
import AppDrawer from "~/components/drawer/AppDrawer.vue";
import AppDrawerActions from "~/components/drawer/AppDrawerActions.vue";
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
const pendingSubmitAction = ref<"approve" | "save">("save");
const isDirty = computed(
  () =>
    Boolean(props.edit && props.submission) &&
    JSON.stringify(props.edit) !== JSON.stringify(props.submission?.payload),
);

function submitReviewAction() {
  if (!props.submission) return;

  if (pendingSubmitAction.value === "approve") {
    emit("approve", props.submission);
  } else {
    emit("save", props.submission);
  }
}

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
    :dirty="isDirty"
    full-height
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
      form-id="community-submission-form"
      map-editing-locked
      point-help="Check and adjust the location points before approving."
      :reset-key="`${submission.id ?? 'submission'}-${submission.updatedAt}`"
      :show-submit="false"
      :show-features="true"
      @submit="submitReviewAction"
    />

    <template v-if="submission" #actions="{ close }">
      <AppDrawerActions>
        <UButton
          color="neutral"
          label="Cancel"
          type="button"
          variant="ghost"
          @click="close"
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
        <UButton
          color="neutral"
          form="community-submission-form"
          icon="i-lucide-save"
          label="Save"
          :loading="reviewing && reviewingAction === 'save'"
          type="submit"
          variant="subtle"
          @click="pendingSubmitAction = 'save'"
        />
        <UButton
          color="success"
          form="community-submission-form"
          icon="i-lucide-check"
          label="Accept"
          :loading="reviewing && reviewingAction === 'approve'"
          type="submit"
          @click="pendingSubmitAction = 'approve'"
        />
      </AppDrawerActions>
    </template>
  </AppDrawer>
</template>
