<script setup lang="ts">
import type { EditableLocationFields } from "#shared/types/locations";
import { locationDescriptionTemplate } from "#shared/utils/location-description";

const { isAdmin, isSignedIn } = useAuth();
const authDrawer = useAuthDrawer();
const emit = defineEmits<{
  "dirty-change": [dirty: boolean];
  submitted: [];
}>();

const isSubmitting = ref(false);
const message = ref("");
const error = ref("");
const formResetKey = ref(0);
const form = reactive<EditableLocationFields>({
  name: "",
  city: "",
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
const initialForm = JSON.stringify(form);

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
    emit("submitted");
  } catch (submitError) {
    error.value = getErrorMessage(submitError);
  } finally {
    isSubmitting.value = false;
  }
}

watch(
  form,
  (value) => emit("dirty-change", JSON.stringify(value) !== initialForm),
  { deep: true, immediate: true },
);
</script>

<template>
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
        label="Sign in"
        variant="subtle"
        @click="authDrawer.show('add')"
      />
    </template>
  </UAlert>

  <AppLocationForm
    v-else
    v-model="form"
    :can-generate-description="isAdmin"
    :error="error"
    :message="message"
    :reset-key="formResetKey"
    form-id="location-add-form"
    :show-features="false"
    :show-submit="false"
    :submitting="isSubmitting"
    submit-label="Submit for review"
    @submit="submitLocation"
  />
</template>
