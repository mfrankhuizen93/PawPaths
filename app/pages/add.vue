<script lang="ts" setup>
import type { EditableLocationFields } from "#shared/types/locations";
import { locationDescriptionTemplate } from "#shared/utils/location-description";
import AppPageHeader from "~/components/common/AppPageHeader.vue";

const { isAdmin, isSignedIn } = useAuth();

const isSubmitting = ref(false);
const message = ref("");
const error = ref("");
const formResetKey = ref(0);
const form = reactive<EditableLocationFields>({
  name: "",
  city: "",
  province: "",
  country: "Netherlands",
  latitude: null,
  longitude: null,
  type: [],
  characteristics: [],
  coordinatePoints: [],
  description: locationDescriptionTemplate,
  relatedUrls: [],
  photos: [],
});

function getErrorMessage(errorValue: unknown) {
  if (
    typeof errorValue === "object" &&
    errorValue &&
    "data" in errorValue &&
    typeof errorValue.data === "object" &&
    errorValue.data &&
    "statusMessage" in errorValue.data
  ) {
    return String(errorValue.data.statusMessage);
  }

  return errorValue instanceof Error
    ? errorValue.message
    : "Something went wrong. Please try again.";
}

function resetForm() {
  form.name = "";
  form.city = "";
  form.province = "";
  form.country = "Netherlands";
  form.latitude = null;
  form.longitude = null;
  form.type = [];
  form.characteristics = [];
  form.coordinatePoints = [];
  form.description = locationDescriptionTemplate;
  form.relatedUrls = [];
  form.photos = [];
  formResetKey.value += 1;
}

async function submitLocation() {
  error.value = "";
  message.value = "";
  isSubmitting.value = true;

  try {
    await $fetch("/api/locations", {
      method: "POST",
      body: form,
    });
    message.value = "Thanks. Your location is waiting for maintainer review.";
    resetForm();
  } catch (submitError) {
    error.value = getErrorMessage(submitError);
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
    <AppPageHeader
      description="New places are reviewed by maintainers before they appear on the map."
      eyebrow="Community"
      title="Add a location"
    />

    <UAlert
      v-if="!isSignedIn"
      color="warning"
      icon="i-lucide-lock"
      title="Sign in to submit a location."
      variant="soft"
    >
      <template #description>
        <UButton
          class="mt-3"
          icon="i-lucide-circle-user-round"
          label="Go to account"
          to="/account"
          variant="subtle"
        />
      </template>
    </UAlert>

    <AppLocationForm
      v-else
      v-model="form"
      :error="error"
      :message="message"
      :reset-key="formResetKey"
      :can-generate-description="isAdmin"
      :submitting="isSubmitting"
      submit-label="Submit for review"
      @submit="submitLocation"
    />
  </div>
</template>
