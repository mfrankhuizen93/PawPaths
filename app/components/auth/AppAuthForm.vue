<script setup lang="ts">
import type { NavigationAppPreference } from "#shared/types/auth";

const emit = defineEmits<{
  authenticated: [];
}>();

const { login, register, requestPasswordReset } = useAuth();
const mode = ref<"login" | "register" | "forgot">("login");
const isSubmitting = ref(false);
const error = ref("");
const message = ref("");
const imageError = ref("");
const form = reactive({
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

function getErrorMessage(errorValue: unknown) {
  if (
    typeof errorValue === "object" &&
    errorValue &&
    "data" in errorValue &&
    typeof errorValue.data === "object" &&
    errorValue.data
  ) {
    if ("statusMessage" in errorValue.data) {
      return String(errorValue.data.statusMessage);
    }

    if ("message" in errorValue.data) {
      return String(errorValue.data.message);
    }
  }

  return errorValue instanceof Error
    ? errorValue.message
    : "Something went wrong. Please try again.";
}

function getInitials() {
  const label = form.name.trim() || form.email.trim() || "?";

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
  if (!context) throw new Error("Could not process that image.");

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

async function handleImageChange(event: Event) {
  imageError.value = "";
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";

  if (!file) return;

  try {
    form.image = await fileToProfileImage(file);
  } catch (errorValue) {
    imageError.value = getErrorMessage(errorValue);
  }
}

async function submit() {
  error.value = "";
  message.value = "";
  isSubmitting.value = true;

  try {
    if (mode.value === "forgot") {
      await requestPasswordReset(form.email);
      message.value =
        "If an account exists for that email, a reset link has been sent.";
      return;
    }

    if (mode.value === "register") {
      await register({ ...form });
      message.value = "Account created. Please verify your email address.";
    } else {
      await login({
        email: form.email,
        password: form.password,
      });
    }

    emit("authenticated");
  } catch (errorValue) {
    error.value = getErrorMessage(errorValue);
  } finally {
    isSubmitting.value = false;
  }
}

watch(mode, () => {
  error.value = "";
  message.value = "";
  imageError.value = "";
});
</script>

<template>
  <div class="grid gap-6 md:grid-cols-[0.8fr_1.2fr]">
    <div class="flex flex-col gap-3">
      <div class="flex flex-wrap gap-2">
        <UButton
          :variant="mode === 'login' ? 'solid' : 'subtle'"
          icon="i-lucide-log-in"
          label="Sign in"
          type="button"
          @click="mode = 'login'"
        />
        <UButton
          :variant="mode === 'register' ? 'solid' : 'subtle'"
          icon="i-lucide-user-plus"
          label="Create account"
          type="button"
          @click="mode = 'register'"
        />
      </div>
      <p class="text-muted text-sm leading-6">
        Sign in to add locations, suggest improvements, save places, and manage
        your profile.
      </p>
    </div>

    <form class="flex flex-col gap-4" @submit.prevent="submit">
      <p v-if="mode === 'forgot'" class="text-muted text-sm leading-6">
        Enter your email and we will send a password reset link.
      </p>

      <UFormField v-if="mode === 'register'" label="Name">
        <UInput
          v-model="form.name"
          autocomplete="name"
          icon="i-lucide-user"
          placeholder="Your name"
        />
      </UFormField>

      <UFormField v-if="mode === 'register'" label="Profile picture">
        <div class="flex items-center gap-4">
          <div
            class="bg-primary/10 text-primary flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full text-lg font-extrabold"
          >
            <img
              v-if="form.image"
              :src="form.image"
              alt=""
              class="size-full object-cover"
            />
            <span v-else>{{ getInitials() }}</span>
          </div>
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
                @change="handleImageChange"
              />
            </UButton>
            <UButton
              v-if="form.image"
              color="neutral"
              icon="i-lucide-x"
              label="Remove"
              type="button"
              variant="ghost"
              @click="form.image = null"
            />
          </div>
        </div>
      </UFormField>

      <UFormField v-if="mode === 'register'" label="Navigation app">
        <USelect
          v-model="form.navigationAppPreference"
          :items="navigationAppOptions"
          icon="i-lucide-navigation"
        />
      </UFormField>

      <UFormField label="Email">
        <UInput
          v-model="form.email"
          autocomplete="email"
          icon="i-lucide-mail"
          placeholder="you@example.com"
          required
          type="email"
        />
      </UFormField>

      <UFormField v-if="mode !== 'forgot'" label="Password">
        <UInput
          v-model="form.password"
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
        v-if="error || imageError"
        :title="error || imageError"
        color="error"
        icon="i-lucide-circle-alert"
        variant="soft"
      />
      <UAlert
        v-if="message"
        :title="message"
        color="success"
        icon="i-lucide-circle-check"
        variant="soft"
      />

      <UButton
        block
        icon="i-lucide-arrow-right"
        :label="
          mode === 'forgot'
            ? 'Send reset link'
            : mode === 'register'
              ? 'Create account'
              : 'Sign in'
        "
        :loading="isSubmitting"
        type="submit"
      />

      <UButton
        v-if="mode === 'login'"
        block
        color="neutral"
        label="Forgot password?"
        type="button"
        variant="link"
        @click="mode = 'forgot'"
      />
      <UButton
        v-if="mode === 'forgot'"
        block
        color="neutral"
        label="Back to sign in"
        type="button"
        variant="link"
        @click="mode = 'login'"
      />
    </form>
  </div>
</template>
