<script lang="ts" setup>
import type { AuthUser, UserRole } from "#shared/types/auth";
import type {
  EditableLocationFields,
  LocationContribution,
} from "#shared/types/locations";

type UsersResponse = {
  users: AuthUser[];
};

type ContributionsResponse = {
  contributions: LocationContribution[];
};

const { user, isAdmin, isMaintainer, isSignedIn } = useAuth();
const { count: pendingContributionCount } = usePendingContributions();

const usersError = ref("");
const users = ref<AuthUser[]>([]);
const contributions = ref<LocationContribution[]>([]);
const contributionEdits = reactive<Record<string, EditableLocationFields>>({});
const contributionEditModes = reactive<Record<string, boolean>>({});
const contributionsError = ref("");
const isLoadingContributions = ref(false);
const isLoadingUsers = ref(false);
const reviewingContribution = ref("");
const reviewingContributionAction = ref<"approve" | "reject" | "save" | "">("");
const previewingContribution = ref("");
const savingRoleFor = ref("");

const roleOptions = [
  { label: "User", value: "user" },
  { label: "Maintainer", value: "maintainer" },
  { label: "Administrator", value: "admin" },
] satisfies { label: string; value: UserRole }[];

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

function getInitials(name: string | undefined, email: string | undefined) {
  const label = name?.trim() || email?.trim() || "?";

  return label
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
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
  const activeIds = new Set(contributions.value.map((item) => item.id));

  for (const contribution of contributions.value) {
    contributionEdits[contribution.id] ??= cloneLocationFields(
      contribution.payload,
    );
    contributionEditModes[contribution.id] ??= false;
  }

  for (const id of Object.keys(contributionEdits)) {
    if (!activeIds.has(id)) delete contributionEdits[id];
  }

  for (const id of Object.keys(contributionEditModes)) {
    if (!activeIds.has(id)) delete contributionEditModes[id];
  }
}

function getContributionEdit(contribution: LocationContribution) {
  contributionEdits[contribution.id] ??= cloneLocationFields(
    contribution.payload,
  );

  return contributionEdits[contribution.id];
}

function getContributionMapMarkers(payload: EditableLocationFields) {
  return [
    {
      id: "general",
      kind: "general" as const,
      label: "General location",
      latitude: payload.latitude,
      longitude: payload.longitude,
    },
    ...(payload.coordinatePoints ?? []),
  ];
}

function isEditingContribution(contribution: LocationContribution) {
  return contributionEditModes[contribution.id] === true;
}

function toggleContributionPreview(contribution: LocationContribution) {
  previewingContribution.value =
    previewingContribution.value === contribution.id ? "" : contribution.id;
}

function editContribution(contribution: LocationContribution) {
  previewingContribution.value = "";
  contributionEdits[contribution.id] = cloneLocationFields(
    contribution.payload,
  );
  contributionEditModes[contribution.id] = true;
}

function cancelContributionEdit(contribution: LocationContribution) {
  contributionEdits[contribution.id] = cloneLocationFields(
    contribution.payload,
  );
  contributionEditModes[contribution.id] = false;
}

function getContributionPayload(contribution: LocationContribution) {
  return cloneLocationFields(getContributionEdit(contribution));
}

function formatContributionDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function loadUsers() {
  if (!isAdmin.value) return;

  usersError.value = "";
  isLoadingUsers.value = true;

  try {
    const response = await $fetch<UsersResponse>("/api/auth/users");
    users.value = response.users;
  } catch (error) {
    usersError.value = getErrorMessage(error);
  } finally {
    isLoadingUsers.value = false;
  }
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
  if (reviewingContribution.value) return;

  contributionsError.value = "";
  reviewingContribution.value = contribution.id;
  reviewingContributionAction.value = action;

  try {
    const shouldSendPayload =
      action === "save" ||
      (action === "approve" && isEditingContribution(contribution));
    const response = await $fetch<{ contribution: LocationContribution }>(
      `/api/contributions/${contribution.id}`,
      {
        method: "PATCH",
        body: {
          action,
          ...(shouldSendPayload
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

      contributionEdits[contribution.id] = cloneLocationFields(
        response.contribution.payload,
      );
      contributionEditModes[contribution.id] = false;
      return;
    }

    contributions.value = contributions.value.filter(
      (item) => item.id !== contribution.id,
    );
    pendingContributionCount.value = contributions.value.length;

    if (previewingContribution.value === contribution.id) {
      previewingContribution.value = "";
    }

    delete contributionEdits[contribution.id];
    delete contributionEditModes[contribution.id];
  } catch (error) {
    contributionsError.value = getErrorMessage(error);
  } finally {
    reviewingContribution.value = "";
    reviewingContributionAction.value = "";
  }
}

async function updateRole(targetUser: AuthUser, role: UserRole) {
  usersError.value = "";
  savingRoleFor.value = targetUser.id;

  try {
    const response = await $fetch<{ user: AuthUser }>(
      `/api/auth/users/${targetUser.id}`,
      {
        method: "PATCH",
        body: { role },
      },
    );
    const index = users.value.findIndex((item) => item.id === targetUser.id);

    if (index >= 0) users.value[index] = response.user;

    if (user.value?.id === response.user.id) user.value = response.user;
  } catch (error) {
    usersError.value = getErrorMessage(error);
  } finally {
    savingRoleFor.value = "";
  }
}

watch(
  isMaintainer,
  (canReview) => {
    if (canReview) void loadContributions();
  },
  { immediate: true },
);

watch(
  isAdmin,
  (canAdmin) => {
    if (canAdmin) void loadUsers();
  },
  { immediate: true },
);
</script>

<template>
  <div class="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6">
    <section class="flex flex-col gap-2">
      <p class="text-brand-600 text-sm font-semibold">Administration</p>
      <h1 class="font-title text-3xl font-extrabold text-slate-950">
        Community management
      </h1>
      <p class="max-w-2xl text-sm leading-6 text-slate-600">
        Review community location submissions and manage access for trusted
        contributors.
      </p>
    </section>

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
      <section id="submissions" class="flex scroll-mt-24 flex-col gap-4">
        <div class="flex items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <h2 class="font-title text-2xl font-extrabold text-slate-950">
                Community submissions
              </h2>
              <UBadge
                v-if="contributions.length"
                color="primary"
                variant="soft"
              >
                {{ contributions.length }}
              </UBadge>
            </div>
            <p class="text-sm text-slate-600">
              Review pending location additions and suggested edits.
            </p>
          </div>
          <UButton
            :loading="isLoadingContributions"
            aria-label="Refresh submissions"
            icon="i-lucide-refresh-cw"
            variant="subtle"
            @click="loadContributions"
          />
        </div>

        <UAlert
          v-if="contributionsError"
          :title="contributionsError"
          color="error"
          icon="i-lucide-circle-alert"
          variant="soft"
        />

        <UCard v-if="!isLoadingContributions && contributions.length === 0">
          <div class="flex items-center gap-3 text-sm text-slate-600">
            <UIcon
              class="size-5 text-emerald-600"
              name="i-lucide-circle-check"
            />
            No pending submissions.
          </div>
        </UCard>

        <div v-else class="flex flex-col gap-3">
          <UCard v-for="contribution in contributions" :key="contribution.id">
            <div class="flex flex-col gap-4">
              <div class="flex flex-col gap-3 sm:flex-row sm:justify-between">
                <div>
                  <div class="flex flex-wrap items-center gap-2">
                    <UBadge color="neutral" variant="soft">
                      {{
                        contribution.kind === "new-location"
                          ? "New location"
                          : "Location edit"
                      }}
                    </UBadge>
                    <p class="font-semibold text-slate-950">
                      {{ contribution.payload.name }}
                    </p>
                  </div>
                  <p class="mt-1 text-sm text-slate-600">
                    Submitted by {{ contribution.submitter.name }} for
                    {{ contribution.locationName || contribution.payload.city }}
                  </p>
                  <p class="mt-1 text-xs text-slate-500">
                    {{ formatContributionDate(contribution.createdAt) }}
                  </p>
                </div>

                <div
                  v-if="isEditingContribution(contribution)"
                  class="flex flex-wrap gap-2"
                >
                  <UButton
                    :loading="
                      reviewingContribution === contribution.id &&
                      reviewingContributionAction === 'approve'
                    "
                    color="success"
                    icon="i-lucide-check"
                    label="Save and approve"
                    variant="subtle"
                    @click="reviewContribution(contribution, 'approve')"
                  />
                  <UButton
                    :loading="
                      reviewingContribution === contribution.id &&
                      reviewingContributionAction === 'save'
                    "
                    color="neutral"
                    icon="i-lucide-save"
                    label="Save"
                    variant="subtle"
                    @click="reviewContribution(contribution, 'save')"
                  />
                  <UButton
                    :disabled="reviewingContribution === contribution.id"
                    color="neutral"
                    icon="i-lucide-x"
                    label="Cancel"
                    variant="ghost"
                    @click="cancelContributionEdit(contribution)"
                  />
                </div>

                <div v-else class="flex flex-wrap gap-2">
                  <UButton
                    :loading="
                      reviewingContribution === contribution.id &&
                      reviewingContributionAction === 'approve'
                    "
                    color="success"
                    icon="i-lucide-check"
                    label="Approve"
                    variant="subtle"
                    @click="reviewContribution(contribution, 'approve')"
                  />
                  <UButton
                    :disabled="reviewingContribution === contribution.id"
                    color="neutral"
                    icon="i-lucide-pencil"
                    label="Edit"
                    variant="subtle"
                    @click="editContribution(contribution)"
                  />
                  <UButton
                    :disabled="reviewingContribution === contribution.id"
                    color="error"
                    icon="i-lucide-x"
                    label="Reject"
                    variant="subtle"
                    @click="reviewContribution(contribution, 'reject')"
                  />
                </div>
              </div>

              <div
                v-if="!isEditingContribution(contribution)"
                class="grid gap-3 text-sm sm:grid-cols-2"
              >
                <div>
                  <p class="font-semibold text-slate-950">Place</p>
                  <p class="text-slate-600">
                    {{ contribution.payload.city }},
                    {{ contribution.payload.country || "Netherlands" }}
                  </p>
                </div>
                <div>
                  <p class="font-semibold text-slate-950">Type</p>
                  <p class="text-slate-600">
                    {{ contribution.payload.type.join(", ") || "No type" }}
                  </p>
                </div>
                <div>
                  <p class="font-semibold text-slate-950">Characteristics</p>
                  <p class="text-slate-600">
                    {{
                      contribution.payload.characteristics.join(", ") ||
                      "No characteristics"
                    }}
                  </p>
                </div>
                <div class="sm:col-span-2">
                  <div class="mb-2 flex items-center justify-between gap-3">
                    <p class="font-semibold text-slate-950">Location points</p>
                    <UButton
                      color="neutral"
                      icon="i-lucide-map"
                      :label="
                        previewingContribution === contribution.id
                          ? 'Hide map'
                          : 'Show map'
                      "
                      size="xs"
                      variant="ghost"
                      @click="toggleContributionPreview(contribution)"
                    />
                  </div>
                  <AppLocationPointPicker
                    v-if="previewingContribution === contribution.id"
                    :latitude="contribution.payload.latitude"
                    :longitude="contribution.payload.longitude"
                    :markers="getContributionMapMarkers(contribution.payload)"
                    readonly
                  />
                  <p v-else class="text-slate-600">
                    {{
                      (contribution.payload.coordinatePoints?.length ?? 0) + 1
                    }}
                    mapped
                    {{
                      (contribution.payload.coordinatePoints?.length ?? 0) +
                        1 ===
                      1
                        ? "point"
                        : "points"
                    }}
                  </p>
                </div>
                <p
                  v-if="contribution.payload.description"
                  class="leading-6 whitespace-pre-line text-slate-700 sm:col-span-2"
                >
                  {{ contribution.payload.description }}
                </p>
              </div>

              <AppLocationForm
                v-else
                v-model="contributionEdits[contribution.id]"
                point-help="Adjust the general point on the map before approving."
                :show-submit="false"
                @submit="reviewContribution(contribution, 'save')"
              />
            </div>
          </UCard>
        </div>
      </section>

      <section
        v-if="isAdmin"
        id="users"
        class="flex scroll-mt-24 flex-col gap-4"
      >
        <div class="flex items-center justify-between gap-4">
          <div>
            <h2 class="font-title text-2xl font-extrabold text-slate-950">
              Users
            </h2>
            <p class="text-sm text-slate-600">
              Promote trusted reviewers or change account roles.
            </p>
          </div>
          <UButton
            :loading="isLoadingUsers"
            aria-label="Refresh users"
            icon="i-lucide-refresh-cw"
            variant="subtle"
            @click="loadUsers"
          />
        </div>

        <UAlert
          v-if="usersError"
          :title="usersError"
          color="error"
          icon="i-lucide-circle-alert"
          variant="soft"
        />

        <UCard :ui="{ body: 'divide-y divide-slate-100 p-0 sm:p-0' }">
          <div
            v-for="account in users"
            :key="account.id"
            class="grid gap-4 p-4 sm:grid-cols-[1fr_12rem] sm:items-center"
          >
            <div class="flex min-w-0 items-center gap-3">
              <UAvatar
                :alt="account.name"
                :src="account.image || undefined"
                :text="getInitials(account.name, account.email)"
              />
              <div class="min-w-0">
                <p class="truncate font-semibold text-slate-950">
                  {{ account.name }}
                </p>
                <p class="truncate text-sm text-slate-600">
                  {{ account.email }}
                </p>
              </div>
            </div>

            <USelect
              :disabled="savingRoleFor === account.id"
              :items="roleOptions"
              :loading="savingRoleFor === account.id"
              :model-value="account.role"
              @update:model-value="updateRole(account, $event as UserRole)"
            />
          </div>
        </UCard>
      </section>
    </template>
  </div>
</template>
