<script setup lang="ts">
import type { TabsItem } from "@nuxt/ui/components/Tabs.vue";
import type {
  EditableLocationFields,
  LocationContribution,
  LocationCoordinateKind,
} from "#shared/types/locations";
import AppEmptyState from "~/components/common/AppEmptyState.vue";
import CommunitySubmissionDrawerSkeleton from "~/components/community/CommunitySubmissionDrawerSkeleton.vue";
import CommunitySubmissionStatusBadge from "~/components/community/CommunitySubmissionStatusBadge.vue";
import AppDrawer from "~/components/drawer/AppDrawer.vue";
import AppDrawerActions from "~/components/drawer/AppDrawerActions.vue";
import AppDrawerHeader from "~/components/drawer/AppDrawerHeader.vue";

const props = defineProps<{
  open: boolean;
  submission: LocationContribution | null;
  edit: EditableLocationFields | null;
  editing?: boolean;
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
  editSubmission: [submission: LocationContribution];
  cancelEdit: [submission: LocationContribution];
}>();

const tabs: TabsItem[] = [
  { label: "Submission", slot: "submission", icon: "i-lucide-file-text" },
  { label: "Location preview", slot: "preview", icon: "i-lucide-map" },
  { label: "Validation", slot: "validation", icon: "i-lucide-badge-check" },
  { label: "History", slot: "history", icon: "i-lucide-history" },
];

const editablePayload = computed({
  get: () => props.edit,
  set: (edit) => {
    if (edit) emit("update:edit", edit);
  },
});

type PreviewMarker = {
  id: string;
  kind: LocationCoordinateKind;
  label: string;
  latitude: number;
  longitude: number;
};

const mapMarkers = computed<PreviewMarker[]>(() => {
  const payload = props.submission?.payload;
  if (!payload) return [];

  const markers = (payload.coordinatePoints ?? []).map((point, index) => ({
    id:
      point.id ?? `${point.kind}-${point.latitude}-${point.longitude}-${index}`,
    kind: point.kind,
    label: point.label,
    latitude: point.latitude,
    longitude: point.longitude,
  }));

  if (
    Number.isFinite(payload.latitude) &&
    Number.isFinite(payload.longitude) &&
    !markers.some((point) => point.kind === "general")
  ) {
    markers.unshift({
      id: "general",
      kind: "general",
      label: "General location",
      latitude: payload.latitude as number,
      longitude: payload.longitude as number,
    });
  }

  return markers;
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
        <div class="mt-3">
          <CommunitySubmissionStatusBadge :kind="submission.kind" />
        </div>
      </AppDrawerHeader>
    </template>

    <CommunitySubmissionDrawerSkeleton v-if="!submission" />

    <UTabs v-else :items="tabs" class="w-full" color="neutral" variant="link">
      <template #submission>
        <div class="flex flex-col gap-4">
          <dl
            class="border-default grid gap-4 rounded-lg border p-4 sm:grid-cols-2"
          >
            <div>
              <dt class="text-muted text-sm font-medium">Place</dt>
              <dd class="text-highlighted mt-1">
                {{ submission.payload.city }},
                {{ submission.payload.country || "Netherlands" }}
              </dd>
            </div>
            <div>
              <dt class="text-muted text-sm font-medium">Type</dt>
              <dd class="text-highlighted mt-1">
                {{ submission.payload.type.join(", ") || "No type" }}
              </dd>
            </div>
            <div class="sm:col-span-2">
              <dt class="text-muted text-sm font-medium">Characteristics</dt>
              <dd class="text-highlighted mt-1">
                {{
                  submission.payload.characteristics.join(", ") ||
                  "No characteristics"
                }}
              </dd>
            </div>
          </dl>

          <div
            v-if="submission.payload.description"
            class="border-default rounded-lg border p-4"
          >
            <h3 class="text-highlighted font-semibold">Description</h3>
            <p class="text-muted mt-2 leading-6 whitespace-pre-line">
              {{ submission.payload.description }}
            </p>
          </div>
        </div>
      </template>

      <template #preview>
        <div class="flex flex-col gap-4">
          <AppLocationPointPicker
            v-if="mapMarkers.length"
            :latitude="submission.payload.latitude"
            :longitude="submission.payload.longitude"
            :markers="mapMarkers"
            readonly
          />
          <AppEmptyState
            v-else
            description="The submitter did not include coordinates."
            icon="i-lucide-map-pin-off"
            title="No mapped points"
          />

          <div
            v-if="submission.payload.photos?.length"
            class="grid grid-cols-2 gap-3 sm:grid-cols-3"
          >
            <NuxtImg
              v-for="photo in submission.payload.photos"
              :key="photo.id || photo.url"
              :alt="photo.alt || submission.payload.name"
              class="aspect-square w-full rounded-lg object-cover"
              :src="photo.url"
            />
          </div>
        </div>
      </template>

      <template #validation>
        <AppLocationForm
          v-if="editing && editablePayload"
          v-model="editablePayload"
          :can-generate-description="canGenerateDescription"
          point-help="Adjust the location details and points before approving."
          :show-submit="false"
          @submit="$emit('save', submission)"
        />

        <div v-else class="flex flex-col gap-4">
          <UAlert
            color="neutral"
            description="Check the submitted details and map preview before choosing an action."
            icon="i-lucide-clipboard-check"
            title="Ready for review"
            variant="soft"
          />
          <div class="grid gap-3 sm:grid-cols-3">
            <UButton
              block
              color="success"
              icon="i-lucide-check"
              label="Approve"
              :loading="reviewing && reviewingAction === 'approve'"
              @click="$emit('approve', submission)"
            />
            <UButton
              block
              color="neutral"
              icon="i-lucide-pencil"
              label="Edit"
              variant="subtle"
              @click="$emit('editSubmission', submission)"
            />
            <UButton
              block
              color="error"
              icon="i-lucide-x"
              label="Reject"
              :loading="reviewing && reviewingAction === 'reject'"
              variant="subtle"
              @click="$emit('reject', submission)"
            />
          </div>
        </div>
      </template>

      <template #history>
        <dl
          class="border-default grid gap-4 rounded-lg border p-4 sm:grid-cols-2"
        >
          <div>
            <dt class="text-muted text-sm font-medium">Submitted</dt>
            <dd class="text-highlighted mt-1">
              {{ formatDate(submission.createdAt) }}
            </dd>
          </div>
          <div>
            <dt class="text-muted text-sm font-medium">Last updated</dt>
            <dd class="text-highlighted mt-1">
              {{ formatDate(submission.updatedAt) }}
            </dd>
          </div>
          <div class="sm:col-span-2">
            <dt class="text-muted text-sm font-medium">Submitted by</dt>
            <dd class="text-highlighted mt-1">
              {{ submission.submitter.name }} ({{ submission.submitter.email }})
            </dd>
          </div>
        </dl>
      </template>
    </UTabs>

    <template v-if="submission && editing" #actions>
      <AppDrawerActions>
        <UButton
          color="neutral"
          label="Cancel"
          variant="ghost"
          @click="$emit('cancelEdit', submission)"
        />
        <UButton
          color="neutral"
          icon="i-lucide-save"
          label="Save"
          :loading="reviewing && reviewingAction === 'save'"
          variant="subtle"
          @click="$emit('save', submission)"
        />
        <UButton
          color="success"
          icon="i-lucide-check"
          label="Save and approve"
          :loading="reviewing && reviewingAction === 'approve'"
          @click="$emit('approve', submission)"
        />
      </AppDrawerActions>
    </template>
  </AppDrawer>
</template>
