<script lang="ts" setup>
import type {
  AuthUser,
  NavigationAppPreference,
  UserRole,
} from "#shared/types/auth";
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

const route = useRoute();
const {
  user,
  isAdmin,
  isMaintainer,
  isSignedIn,
  login,
  logout,
  register,
  requestPasswordReset,
  refreshSession,
  sendVerificationEmail,
  updateProfile,
} = useAuth();

const mode = ref<"login" | "register" | "forgot">("login");
const isSubmitting = ref(false);
const isLoadingUsers = ref(false);
const isResendingVerification = ref(false);
const isSavingProfile = ref(false);
const authError = ref("");
const authMessage = ref("");
const usersError = ref("");
const users = ref<AuthUser[]>([]);
const contributions = ref<LocationContribution[]>([]);
const contributionEdits = reactive<Record<string, EditableLocationFields>>({});
const contributionEditModes = reactive<Record<string, boolean>>({});
const contributionsError = ref("");
const isLoadingContributions = ref(false);
const reviewingContribution = ref("");
const reviewingContributionAction = ref<"approve" | "reject" | "save" | "">("");
const previewingContribution = ref("");
const savingRoleFor = ref("");
const profileError = ref("");
const profileMessage = ref("");
const selectedProfileImage = ref<string | null>(null);
const imageError = ref("");
const profileForm = reactive({
  name: "",
  image: null as string | null,
  navigationAppPreference: "device" as NavigationAppPreference,
});

const authForm = reactive({
  name: "",
  email: "",
  password: "",
  image: null as string | null,
  navigationAppPreference: "device" as NavigationAppPreference,
});

const roleOptions = [
  { label: "User", value: "user" },
  { label: "Maintainer", value: "maintainer" },
  { label: "Administrator", value: "admin" },
] satisfies { label: string; value: UserRole }[];

const navigationAppOptions = [
  { label: "Device default", value: "device" },
  { label: "Apple Maps", value: "apple" },
  { label: "Google Maps", value: "google" },
  { label: "Waze", value: "waze" },
] satisfies { label: string; value: NavigationAppPreference }[];

const roleLabels: Record<UserRole, string> = {
  admin: "Administrator",
  maintainer: "Maintainer",
  user: "User",
};

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

  if (
    typeof error === "object" &&
    error &&
    "data" in error &&
    typeof error.data === "object" &&
    error.data &&
    "message" in error.data
  ) {
    return String(error.data.message);
  }

  if (error instanceof Error) {
    return error.message;
  }

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
    if (!activeIds.has(id)) {
      delete contributionEdits[id];
    }
  }

  for (const id of Object.keys(contributionEditModes)) {
    if (!activeIds.has(id)) {
      delete contributionEditModes[id];
    }
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

function getContributionPayload(
  contribution: LocationContribution,
): EditableLocationFields {
  return cloneLocationFields(getContributionEdit(contribution));
}

function formatContributionDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

async function fileToProfileImage(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose a JPG, PNG, or WebP image.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Choose an image under 5 MB.");
  }

  const bitmap = await createImageBitmap(file);
  const size = 512;
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not process that image.");
  }

  context.drawImage(
    bitmap,
    Math.round((size - width) / 2),
    Math.round((size - height) / 2),
    width,
    height,
  );
  bitmap.close();

  return canvas.toDataURL("image/jpeg", 0.86);
}

async function handleProfileImageChange(event: Event) {
  imageError.value = "";

  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";

  if (!file) return;

  try {
    selectedProfileImage.value = await fileToProfileImage(file);

    if (isSignedIn.value) {
      profileForm.image = selectedProfileImage.value;
    } else {
      authForm.image = selectedProfileImage.value;
    }
  } catch (error) {
    imageError.value = getErrorMessage(error);
  }
}

function clearSelectedImage() {
  selectedProfileImage.value = null;

  if (isSignedIn.value) {
    profileForm.image = null;
  } else {
    authForm.image = null;
  }
}

async function submitAuth() {
  authError.value = "";
  authMessage.value = "";
  isSubmitting.value = true;

  try {
    if (mode.value === "forgot") {
      await requestPasswordReset(authForm.email);

      authMessage.value =
        "If an account exists for that email, a reset link has been sent.";
    } else if (mode.value === "register") {
      await register({ ...authForm });
      authMessage.value = "Account created. Please verify your email address.";
    } else {
      await login({
        email: authForm.email,
        password: authForm.password,
      });
    }
  } catch (error) {
    authError.value = getErrorMessage(error);
  } finally {
    isSubmitting.value = false;
  }
}

async function saveProfile() {
  profileError.value = "";
  profileMessage.value = "";
  isSavingProfile.value = true;

  try {
    await updateProfile({
      name: profileForm.name.trim() || user.value?.name,
      image: profileForm.image,
      navigationAppPreference: profileForm.navigationAppPreference,
    });
    profileMessage.value = "Profile updated.";
  } catch (error) {
    profileError.value = getErrorMessage(error);
  } finally {
    isSavingProfile.value = false;
  }
}

async function resendVerification() {
  authError.value = "";
  authMessage.value = "";
  isResendingVerification.value = true;

  try {
    if (user.value?.email) {
      await sendVerificationEmail(user.value.email);
    }
    authMessage.value = "Verification link sent.";
    await refreshSession();
  } catch (error) {
    authError.value = getErrorMessage(error);
  } finally {
    isResendingVerification.value = false;
  }
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

      if (index >= 0) {
        contributions.value[index] = response.contribution;
      }

      contributionEdits[contribution.id] = cloneLocationFields(
        response.contribution.payload,
      );
      contributionEditModes[contribution.id] = false;
      return;
    }

    contributions.value = contributions.value.filter(
      (item) => item.id !== contribution.id,
    );
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

    if (index >= 0) {
      users.value[index] = response.user;
    }

    if (user.value?.id === response.user.id) {
      user.value = response.user;
    }
  } catch (error) {
    usersError.value = getErrorMessage(error);
  } finally {
    savingRoleFor.value = "";
  }
}

watch(isAdmin, (canAdmin) => {
  if (canAdmin) {
    void loadUsers();
  }
});

watch(isMaintainer, (canReview) => {
  if (canReview) {
    void loadContributions();
  }
});

watch(
  user,
  (currentUser) => {
    profileForm.name = currentUser?.name ?? "";
    profileForm.image = currentUser?.image ?? null;
    profileForm.navigationAppPreference =
      currentUser?.navigationAppPreference ?? "device";
    selectedProfileImage.value = currentUser?.image ?? null;
  },
  { immediate: true },
);

watch(mode, () => {
  imageError.value = "";

  if (!isSignedIn.value) {
    selectedProfileImage.value = authForm.image;
  }
});

onMounted(() => {
  if (route.query.verified === "true") {
    authMessage.value = "Your email has been verified.";
    void refreshSession();
  }

  if (route.query.error) {
    authError.value = "That verification link is invalid or has expired.";
  }

  if (isAdmin.value) {
    void loadUsers();
  }

  if (isMaintainer.value) {
    void loadContributions();
  }
});
</script>

<template>
  <div class="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8 sm:px-6">
    <section class="flex flex-col gap-2">
      <p class="text-brand-600 text-sm font-semibold">Account</p>
      <h1 class="font-title text-3xl font-extrabold text-slate-950">
        PawPaths profile
      </h1>
    </section>

    <section
      v-if="!isSignedIn"
      class="grid gap-6 rounded-md border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[0.9fr_1.1fr]"
    >
      <div class="flex flex-col gap-3">
        <div class="flex gap-2">
          <UButton
            :variant="mode === 'login' ? 'solid' : 'subtle'"
            icon="i-lucide-log-in"
            label="Sign in"
            @click="mode = 'login'"
          />
          <UButton
            :variant="mode === 'register' ? 'solid' : 'subtle'"
            icon="i-lucide-user-plus"
            label="Create account"
            @click="mode = 'register'"
          />
        </div>
        <p class="text-sm leading-6 text-slate-600">
          Signed-in users can submit improvements and photos. Maintainers can
          review community changes, and administrators can manage roles.
        </p>
      </div>

      <form class="flex flex-col gap-4" @submit.prevent="submitAuth">
        <p v-if="mode === 'forgot'" class="text-sm leading-6 text-slate-600">
          Enter your email and we will send a password reset link.
        </p>

        <UFormField v-if="mode === 'register'" label="Name">
          <UInput
            v-model="authForm.name"
            autocomplete="name"
            icon="i-lucide-user"
            placeholder="Your name"
          />
        </UFormField>

        <UFormField v-if="mode === 'register'" label="Profile picture">
          <div class="flex items-center gap-4">
            <div
              class="bg-brand-100 text-brand-700 flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full text-lg font-extrabold"
            >
              <img
                v-if="authForm.image"
                :src="authForm.image"
                alt=""
                class="size-full object-cover"
              />
              <span v-else>{{
                getInitials(authForm.name, authForm.email)
              }}</span>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <UButton
                as="label"
                color="neutral"
                icon="i-lucide-image-plus"
                label="Choose image"
                variant="subtle"
              >
                <input
                  accept="image/jpeg,image/png,image/webp"
                  class="sr-only"
                  type="file"
                  @change="handleProfileImageChange"
                />
              </UButton>
              <UButton
                v-if="authForm.image"
                color="neutral"
                icon="i-lucide-x"
                label="Remove"
                variant="ghost"
                @click="clearSelectedImage"
              />
            </div>
          </div>
        </UFormField>

        <UFormField v-if="mode === 'register'" label="Navigation app">
          <USelect
            v-model="authForm.navigationAppPreference"
            :items="navigationAppOptions"
            icon="i-lucide-navigation"
          />
        </UFormField>

        <UFormField label="Email">
          <UInput
            v-model="authForm.email"
            autocomplete="email"
            icon="i-lucide-mail"
            placeholder="you@example.com"
            required
            type="email"
          />
        </UFormField>

        <UFormField v-if="mode !== 'forgot'" label="Password">
          <UInput
            v-model="authForm.password"
            :autocomplete="
              mode === 'register' ? 'new-password' : 'current-password'
            "
            icon="i-lucide-lock"
            placeholder="At least 10 characters"
            required
            type="password"
          />
        </UFormField>

        <UAlert
          v-if="authError"
          :title="authError"
          color="error"
          icon="i-lucide-circle-alert"
          variant="soft"
        />

        <UAlert
          v-if="authMessage"
          :title="authMessage"
          color="success"
          icon="i-lucide-circle-check"
          variant="soft"
        />

        <UAlert
          v-if="imageError"
          :title="imageError"
          color="error"
          icon="i-lucide-image-off"
          variant="soft"
        />

        <UButton
          :label="
            mode === 'forgot'
              ? 'Send reset link'
              : mode === 'register'
                ? 'Create account'
                : 'Sign in'
          "
          :loading="isSubmitting"
          block
          icon="i-lucide-arrow-right"
          type="submit"
        />

        <UButton
          v-if="mode === 'login'"
          block
          color="neutral"
          label="Forgot password?"
          variant="link"
          @click="mode = 'forgot'"
        />

        <UButton
          v-if="mode === 'forgot'"
          block
          color="neutral"
          label="Back to sign in"
          variant="link"
          @click="mode = 'login'"
        />
      </form>
    </section>

    <section
      v-else
      class="flex flex-col gap-5 rounded-md border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div
        class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="flex min-w-0 items-center gap-4">
          <div
            class="bg-brand-100 text-brand-700 flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full text-lg font-extrabold"
          >
            <img
              v-if="user?.image"
              :src="user.image"
              alt=""
              class="size-full object-cover"
            />
            <span v-else>{{ getInitials(user?.name, user?.email) }}</span>
          </div>
          <div class="min-w-0">
            <h2
              class="font-title truncate text-2xl font-extrabold text-slate-950"
            >
              {{ user?.name }}
            </h2>
            <p class="truncate text-sm text-slate-600">{{ user?.email }}</p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <UBadge
            :color="user?.emailVerified ? 'success' : 'warning'"
            variant="soft"
          >
            {{ user?.emailVerified ? "Verified" : "Unverified" }}
          </UBadge>
          <UBadge color="neutral" variant="soft">
            {{ user ? roleLabels[user.role] : "" }}
          </UBadge>
          <UButton
            color="neutral"
            icon="i-lucide-log-out"
            label="Sign out"
            variant="subtle"
            @click="logout"
          />
        </div>
      </div>

      <UAlert
        v-if="authError"
        :title="authError"
        color="error"
        icon="i-lucide-circle-alert"
        variant="soft"
      />

      <UAlert
        v-if="authMessage"
        :title="authMessage"
        color="success"
        icon="i-lucide-circle-check"
        variant="soft"
      />

      <form
        class="grid gap-4 md:grid-cols-[auto_1fr_auto]"
        @submit.prevent="saveProfile"
      >
        <div
          class="bg-brand-100 text-brand-700 flex size-20 items-center justify-center overflow-hidden rounded-full text-xl font-extrabold"
        >
          <img
            v-if="profileForm.image"
            :src="profileForm.image"
            alt=""
            class="size-full object-cover"
          />
          <span v-else>{{ getInitials(profileForm.name, user?.email) }}</span>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <UFormField label="Display name">
            <UInput
              v-model="profileForm.name"
              autocomplete="name"
              icon="i-lucide-user"
              placeholder="Your name"
            />
          </UFormField>

          <UFormField label="Profile picture">
            <div class="flex flex-wrap gap-2">
              <UButton
                as="label"
                color="neutral"
                icon="i-lucide-image-plus"
                label="Choose image"
                variant="subtle"
              >
                <input
                  accept="image/jpeg,image/png,image/webp"
                  class="sr-only"
                  type="file"
                  @change="handleProfileImageChange"
                />
              </UButton>
              <UButton
                v-if="profileForm.image"
                color="neutral"
                icon="i-lucide-x"
                label="Remove"
                variant="ghost"
                @click="clearSelectedImage"
              />
            </div>
          </UFormField>

          <UFormField label="Navigation app">
            <USelect
              v-model="profileForm.navigationAppPreference"
              :items="navigationAppOptions"
              icon="i-lucide-navigation"
            />
          </UFormField>
        </div>

        <div class="flex items-end">
          <UButton
            :loading="isSavingProfile"
            icon="i-lucide-save"
            label="Save"
            type="submit"
          />
        </div>
      </form>

      <UAlert
        v-if="profileError || imageError"
        :title="profileError || imageError"
        color="error"
        icon="i-lucide-circle-alert"
        variant="soft"
      />

      <UAlert
        v-if="profileMessage"
        :title="profileMessage"
        color="success"
        icon="i-lucide-circle-check"
        variant="soft"
      />

      <div v-if="user && !user.emailVerified">
        <UButton
          :loading="isResendingVerification"
          icon="i-lucide-mail-check"
          label="Resend verification email"
          variant="subtle"
          @click="resendVerification"
        />
      </div>
    </section>

    <section v-if="isMaintainer" class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-4">
        <div>
          <h2 class="font-title text-2xl font-extrabold text-slate-950">
            Community submissions
          </h2>
          <p class="text-sm text-slate-600">
            Review pending location additions and suggested edits.
          </p>
        </div>
        <UButton
          :loading="isLoadingContributions"
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

      <div
        v-if="contributions.length === 0"
        class="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600"
      >
        No pending submissions.
      </div>

      <div v-else class="flex flex-col gap-3">
        <article
          v-for="contribution in contributions"
          :key="contribution.id"
          class="flex flex-col gap-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm"
        >
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
                type="button"
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
                type="button"
                variant="subtle"
                @click="reviewContribution(contribution, 'save')"
              />
              <UButton
                :disabled="reviewingContribution === contribution.id"
                color="neutral"
                icon="i-lucide-x"
                label="Cancel"
                type="button"
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
                type="button"
                variant="subtle"
                @click="reviewContribution(contribution, 'approve')"
              />
              <UButton
                :disabled="reviewingContribution === contribution.id"
                color="neutral"
                icon="i-lucide-pencil"
                label="Edit"
                type="button"
                variant="subtle"
                @click="editContribution(contribution)"
              />
              <UButton
                :disabled="reviewingContribution === contribution.id"
                color="error"
                icon="i-lucide-x"
                label="Reject"
                type="button"
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
                  type="button"
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
                  (contribution.payload.coordinatePoints?.length ?? 0) + 1 === 1
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
        </article>
      </div>
    </section>

    <section v-if="isAdmin" class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-4">
        <div>
          <h2 class="font-title text-2xl font-extrabold text-slate-950">
            User roles
          </h2>
          <p class="text-sm text-slate-600">
            Administrators can promote trusted reviewers to maintainer.
          </p>
        </div>
        <UButton
          :loading="isLoadingUsers"
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

      <div class="overflow-hidden rounded-md border border-slate-200 bg-white">
        <div
          v-for="account in users"
          :key="account.id"
          class="grid gap-4 border-b border-slate-100 p-4 last:border-b-0 sm:grid-cols-[1fr_12rem]"
        >
          <div class="min-w-0">
            <div class="flex min-w-0 items-center gap-3">
              <div
                class="bg-brand-100 text-brand-700 flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-extrabold"
              >
                <img
                  v-if="account.image"
                  :src="account.image"
                  alt=""
                  class="size-full object-cover"
                />
                <span v-else>{{
                  getInitials(account.name, account.email)
                }}</span>
              </div>
              <div class="min-w-0">
                <p class="truncate font-semibold text-slate-950">
                  {{ account.name }}
                </p>
                <p class="truncate text-sm text-slate-600">
                  {{ account.email }}
                </p>
              </div>
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
      </div>
    </section>
  </div>
</template>
