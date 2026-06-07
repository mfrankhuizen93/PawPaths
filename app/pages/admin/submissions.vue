<script lang="ts" setup>
import type {
  EditableLocationFields,
  LocationContribution,
} from "#shared/types/locations";
import AppPageHeader from "~/components/common/AppPageHeader.vue";
import CommunitySubmissionDrawer from "~/components/community/CommunitySubmissionDrawer.vue";
import CommunitySubmissionList from "~/components/community/CommunitySubmissionList.vue";

definePageMeta({
  middleware: "maintainer",
});

type ContributionsResponse = {
  contributions: LocationContribution[];
};

const { isAdmin, isMaintainer, isSignedIn } = useAuth();
const { count: pendingContributionCount } = usePendingContributions();

const contributions = ref<LocationContribution[]>([]);
const contributionEdits = reactive<Record<string, EditableLocationFields>>({});
const contributionsError = ref("");
const isLoadingContributions = ref(false);
const reviewingContribution = ref("");
const reviewingContributionAction = ref<"approve" | "reject" | "save" | "">("");
const selectedSubmission = ref<LocationContribution | null>(null);
const isSubmissionDrawerOpen = computed({
  get: () => Boolean(selectedSubmission.value),
  set: (open) => {
    if (!open) selectedSubmission.value = null;
  },
});
const selectedSubmissionEdit = computed<EditableLocationFields | null>(() => {
  if (!selectedSubmission.value?.id) return null;

  return getContributionEdit(selectedSubmission.value);
});

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error &&
    "data" in error &&
    typeof error.data === "object" &&
    error.data &&
    "statusMessage" in error.data
  ) {
    return String(error.data.statusMessage);
  }

  if (error instanceof Error) return error.message;

  return "Something went wrong. Please try again.";
}

function cloneLocationFields(
  payload: EditableLocationFields,
): EditableLocationFields {
  return {
    name: payload.name ?? "",
    city: payload.city ?? "",
    province: payload.province ?? "",
    country: payload.country ?? "Netherlands",
    latitude: payload.latitude ?? null,
    longitude: payload.longitude ?? null,
    type: [...(payload.type ?? [])],
    characteristics: [...(payload.characteristics ?? [])],
    description: payload.description ?? "",
    relatedUrls: (payload.relatedUrls ?? []).map((url) => ({ ...url })),
    photos: (payload.photos ?? []).map((photo) => ({ ...photo })),
    coordinatePoints: (payload.coordinatePoints ?? []).map((point) => ({
      ...point,
    })),
  };
}

function syncContributionEdits() {
  const activeIds = new Set(
    contributions.value
      .map((item) => item.id)
      .filter((id): id is string => Boolean(id)),
  );

  for (const contribution of contributions.value) {
    if (!contribution.id) continue;

    contributionEdits[contribution.id] ??= cloneLocationFields(
      contribution.payload,
    );
  }

  for (const id of Object.keys(contributionEdits)) {
    if (!activeIds.has(id)) delete contributionEdits[id];
  }
}

function getContributionEdit(contribution: LocationContribution) {
  if (!contribution.id) {
    return cloneLocationFields(contribution.payload);
  }

  contributionEdits[contribution.id] ??= cloneLocationFields(
    contribution.payload,
  );
  return contributionEdits[contribution.id]!;
}

function getContributionPayload(contribution: LocationContribution) {
  return cloneLocationFields(getContributionEdit(contribution));
}

function openSubmission(contribution: LocationContribution) {
  selectedSubmission.value = contribution;
}

function updateSelectedEdit(edit: EditableLocationFields) {
  if (!selectedSubmission.value?.id) return;

  contributionEdits[selectedSubmission.value.id] = edit;
}

async function loadContributions() {
  if (!isMaintainer.value) return;

  contributionsError.value = "";
  isLoadingContributions.value = true;

  try {
    const response = await $fetch<ContributionsResponse>("/api/contributions");
    contributions.value = response.contributions;
    pendingContributionCount.value = response.contributions.length;
    syncContributionEdits();
    if (selectedSubmission.value) {
      selectedSubmission.value =
        contributions.value.find(
          (item) => item.id === selectedSubmission.value?.id,
        ) ?? null;
    }
  } catch (error) {
    contributionsError.value = getErrorMessage(error);
  } finally {
    isLoadingContributions.value = false;
  }
}

async function reviewContribution(
  contribution: LocationContribution,
  action: "approve" | "reject" | "save",
) {
  if (reviewingContribution.value || !contribution.id) return;

  contributionsError.value = "";
  const contributionId = contribution.id;
  reviewingContribution.value = contributionId;
  reviewingContributionAction.value = action;

  try {
    const response = await $fetch<{ contribution: LocationContribution }>(
      `/api/contributions/${contributionId}`,
      {
        method: "PATCH",
        body: {
          action,
          ...(action === "save" || action === "approve"
            ? { payload: getContributionPayload(contribution) }
            : {}),
        },
      },
    );

    if (action === "save") {
      const index = contributions.value.findIndex(
        (item) => item.id === response.contribution.id,
      );

      if (index >= 0) contributions.value[index] = response.contribution;

      contributionEdits[contributionId] = cloneLocationFields(
        response.contribution.payload,
      );
      selectedSubmission.value = response.contribution;
      return;
    }

    contributions.value = contributions.value.filter(
      (item) => item.id !== contributionId,
    );
    pendingContributionCount.value = contributions.value.length;

    if (selectedSubmission.value?.id === contributionId) {
      selectedSubmission.value = null;
    }

    delete contributionEdits[contributionId];
  } catch (error) {
    contributionsError.value = getErrorMessage(error);
  } finally {
    reviewingContribution.value = "";
    reviewingContributionAction.value = "";
  }
}

watch(
  isMaintainer,
  (canReview) => {
    if (canReview) void loadContributions();
  },
  { immediate: true },
);
</script>

<template>
  <div class="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6">
    <AppPageHeader
      :badge="isMaintainer ? contributions.length : undefined"
      description="Review pending location additions and suggested edits."
      eyebrow="Administration"
      title="Community submissions"
    >
      <template v-if="isMaintainer" #actions>
        <UButton
          :loading="isLoadingContributions"
          aria-label="Refresh submissions"
          icon="i-lucide-refresh-cw"
          label="Refresh"
          variant="subtle"
          @click="loadContributions"
        />
      </template>
    </AppPageHeader>

    <UAlert
      v-if="!isSignedIn"
      title="Sign in to access administration."
      color="warning"
      icon="i-lucide-lock"
      variant="soft"
    >
      <template #actions>
        <UButton label="Go to account" to="/account" />
      </template>
    </UAlert>

    <UAlert
      v-else-if="!isMaintainer"
      title="You do not have access to this page."
      color="error"
      icon="i-lucide-shield-alert"
      variant="soft"
    />

    <template v-else>
      <section class="flex flex-col gap-4">
        <UAlert
          v-if="contributionsError"
          :title="contributionsError"
          color="error"
          icon="i-lucide-circle-alert"
          variant="soft"
        />

        <CommunitySubmissionList
          :loading="isLoadingContributions"
          :submissions="contributions"
          @select="openSubmission"
        />
      </section>

      <CommunitySubmissionDrawer
        v-model:open="isSubmissionDrawerOpen"
        :can-generate-description="isAdmin"
        :edit="selectedSubmissionEdit"
        :reviewing="reviewingContribution === selectedSubmission?.id"
        :reviewing-action="reviewingContributionAction"
        :submission="selectedSubmission"
        @approve="reviewContribution($event, 'approve')"
        @reject="reviewContribution($event, 'reject')"
        @save="reviewContribution($event, 'save')"
        @update:edit="updateSelectedEdit"
      />
    </template>
  </div>
</template>
