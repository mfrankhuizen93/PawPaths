<script lang="ts" setup>
const { isAdmin, isMaintainer, isSignedIn } = useAuth();

await navigateTo(
  !isSignedIn.value
    ? "/account"
    : isAdmin.value
      ? "/admin/users"
      : isMaintainer.value
        ? "/admin/submissions"
        : "/account",
  { replace: true },
);
</script>

<template>
  <div />
</template>
