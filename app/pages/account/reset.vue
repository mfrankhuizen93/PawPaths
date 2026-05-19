<script lang="ts" setup>
const route = useRoute();
const { resetPassword } = useAuth();

const password = ref("");
const isSubmitting = ref(false);
const error = ref("");
const message = ref("");

function getErrorMessage(resetError: unknown) {
  if (
    typeof resetError === "object" &&
    resetError &&
    "data" in resetError &&
    typeof resetError.data === "object" &&
    resetError.data &&
    "statusMessage" in resetError.data
  ) {
    return String(resetError.data.statusMessage);
  }

  if (resetError instanceof Error) {
    return resetError.message;
  }

  return "This reset link is invalid or has expired.";
}

async function submitReset() {
  error.value = "";
  message.value = "";
  isSubmitting.value = true;

  try {
    await resetPassword({
      token: String(route.query.token ?? ""),
      password: password.value,
    });
    message.value = "Your password has been reset.";
  } catch (resetError) {
    error.value = getErrorMessage(resetError);
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-10 sm:px-6">
    <section class="flex flex-col gap-2">
      <p class="text-brand-600 text-sm font-semibold">Account</p>
      <h1 class="font-title text-3xl font-extrabold text-slate-950">
        Reset password
      </h1>
    </section>

    <form
      class="flex flex-col gap-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm"
      @submit.prevent="submitReset"
    >
      <UFormField label="New password">
        <UInput
          v-model="password"
          autocomplete="new-password"
          icon="i-lucide-lock"
          placeholder="At least 10 characters"
          required
          type="password"
        />
      </UFormField>

      <UAlert
        v-if="error"
        :title="error"
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
        :loading="isSubmitting"
        block
        icon="i-lucide-arrow-right"
        label="Reset password"
        type="submit"
      />
    </form>
  </div>
</template>
