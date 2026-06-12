<script lang="ts" setup>
const { isAdmin, isMaintainer, isSignedIn } = useAuth();

await navigateTo(
  !isSignedIn.value
    ? "/?profile=true"
    : isAdmin.value
      ? "/admin/users"
      : isMaintainer.value
        ? "/admin/submissions"
        : "/?profile=true",
  { replace: true },
);
</script>

<template>
  <div />
</template>
