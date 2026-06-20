<script setup lang="ts">
import type { NavigationAppPreference } from "#shared/types/auth";

const route = useRoute();
const toast = useToast();
const { user, refreshSession, sendVerificationEmail, updateProfile } =
  useAuth();

const isResendingVerification = ref(false);
const isSavingProfile = ref(false);
const authError = ref("");
const authMessage = ref("");
const profileError = ref("");
const imageError = ref("");
const profileForm = reactive({
  name: "",
  image: null as string | null,
  navigationAppPreference: "device" as NavigationAppPreference,
});

const navigationAppOptions = [
  { label: "Device default", value: "device" },
  { label: "Apple Maps", value: "apple" },
  { label: "Google Maps", value: "google" },
  { label: "Waze", value: "waze" },
] satisfies { label: string; value: NavigationAppPreference }[];

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
    bitmap.close();
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
    profileForm.image = await fileToProfileImage(file);
  } catch (error) {
    imageError.value = getErrorMessage(error);
  }
}

async function saveProfile() {
  profileError.value = "";
  isSavingProfile.value = true;

  try {
    await updateProfile({
      name: profileForm.name.trim() || user.value?.name,
      image: profileForm.image,
      navigationAppPreference: profileForm.navigationAppPreference,
    });
    toast.add({
      title: "Profile saved",
      description: "Your PawPaths profile is up to date.",
      color: "success",
      icon: "i-lucide-circle-check",
    });
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
  },
  { immediate: true },
);

onMounted(() => {
  if (route.query.verified === "true") {
    authMessage.value = "Your email has been verified.";
  }

  if (route.query.error) {
    authError.value = "That verification link is invalid or has expired.";
  }
});
</script>

<template>
  <form class="flex flex-col gap-5" @submit.prevent="saveProfile">
    <section class="flex flex-col gap-4">
      <div class="flex items-center gap-4">
        <UAvatar
          :alt="profileForm.name || 'Profile picture'"
          class="size-16 text-xl"
          :src="profileForm.image || undefined"
          :text="getInitials(profileForm.name, user?.email)"
        />

        <div class="flex flex-wrap gap-2">
          <UButton
            as="label"
            color="neutral"
            icon="i-lucide-camera"
            label="Choose photo"
            variant="soft"
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
            icon="i-lucide-trash-2"
            label="Remove"
            type="button"
            variant="ghost"
            @click="profileForm.image = null"
          />
        </div>
      </div>

      <UFormField
        description="This is shown with your reviews and contributions."
        label="Display name"
      >
        <UInput
          v-model="profileForm.name"
          autocomplete="name"
          class="w-full"
          placeholder="Your name"
        />
      </UFormField>
    </section>

    <USeparator />

    <UFormField
      description="Choose which app opens when you ask for directions."
      label="Preferred navigation app"
    >
      <USelect
        v-model="profileForm.navigationAppPreference"
        class="w-full"
        :items="navigationAppOptions"
        placeholder="Choose an app"
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
      v-if="profileError || imageError"
      :title="profileError || imageError"
      color="error"
      icon="i-lucide-circle-alert"
      variant="soft"
    />

    <UAlert
      v-if="user && !user.emailVerified"
      color="warning"
      description="Verify your email address to keep your account secure."
      icon="i-lucide-mail-warning"
      title="Email not verified"
      variant="soft"
    >
      <template #actions>
        <UButton
          :loading="isResendingVerification"
          icon="i-lucide-mail-check"
          label="Send verification link"
          type="button"
          variant="subtle"
          @click="resendVerification"
        />
      </template>
    </UAlert>

    <div class="flex justify-end">
      <UButton
        :loading="isSavingProfile"
        icon="i-lucide-check"
        label="Save profile"
        size="lg"
        type="submit"
      />
    </div>
  </form>
</template>
