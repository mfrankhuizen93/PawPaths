<script lang="ts" setup>
import type { NavigationAppPreference, UserRole } from "#shared/types/auth";
import AppPageHeader from "~/components/common/AppPageHeader.vue";

const route = useRoute();
const {
  user,
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
const isResendingVerification = ref(false);
const isSavingProfile = ref(false);
const authError = ref("");
const authMessage = ref("");
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
});
</script>

<template>
  <div class="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-8 sm:px-6">
    <AppPageHeader eyebrow="Account" title="PawPaths profile" />

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
  </div>
</template>
