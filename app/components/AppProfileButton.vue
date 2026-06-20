<script lang="ts" setup>
const props = withDefaults(
  defineProps<{
    floating?: boolean;
  }>(),
  {
    floating: false,
  },
);

const { isSignedIn, user } = useAuth();
const authDrawer = useAuthDrawer();

const initials = computed(() => {
  const label = user.value?.name?.trim() || user.value?.email?.trim() || "";

  return label
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
});

function openProfile() {
  authDrawer.show("profile");
}
</script>

<template>
  <UButton
    aria-label="Open profile"
    :class="[
      'justify-center border p-0',
      floating
        ? 'border-default/60 bg-default/88 size-12 rounded-2xl shadow-lg backdrop-blur-xl'
        : 'border-default size-10 rounded-xl',
    ]"
    color="neutral"
    square
    variant="ghost"
    @click="openProfile"
  >
    <UAvatar
      :alt="user?.name || 'Profile'"
      :icon="isSignedIn ? undefined : 'i-lucide-user'"
      :size="props.floating ? 'lg' : 'md'"
      :src="user?.image || undefined"
      :text="initials || undefined"
    />
  </UButton>
</template>
