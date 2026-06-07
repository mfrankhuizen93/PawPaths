<script setup lang="ts">
import type { AuthUser } from "#shared/types/auth";
import AppEmptyState from "~/components/common/AppEmptyState.vue";
import UserRoleBadge from "~/components/users/UserRoleBadge.vue";
import UserRolesTableSkeleton from "~/components/users/UserRolesTableSkeleton.vue";

defineProps<{
  users: AuthUser[];
  loading?: boolean;
}>();

defineEmits<{
  selectUser: [user: AuthUser];
}>();

function getInitials(name: string | undefined, email: string | undefined) {
  const label = name?.trim() || email?.trim() || "?";

  return label
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
</script>

<template>
  <UserRolesTableSkeleton v-if="loading" />

  <AppEmptyState
    v-else-if="users.length === 0"
    description="New accounts will appear here when they sign up."
    icon="i-lucide-users"
    title="No users found"
  />

  <UCard v-else :ui="{ body: 'divide-y divide-default p-0 sm:p-0' }">
    <button
      v-for="account in users"
      :key="account.id"
      class="hover:bg-elevated focus-visible:outline-primary grid w-full gap-3 p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] sm:grid-cols-[1fr_auto] sm:items-center"
      type="button"
      @click="$emit('selectUser', account)"
    >
      <span class="flex min-w-0 items-center gap-3">
        <UAvatar
          :alt="account.name"
          :src="account.image || undefined"
          :text="getInitials(account.name, account.email)"
        />
        <span class="min-w-0">
          <span class="text-highlighted block truncate font-semibold">
            {{ account.name }}
          </span>
          <span class="text-muted block truncate text-sm">
            {{ account.email }}
          </span>
        </span>
      </span>

      <span class="flex items-center justify-between gap-3 sm:justify-end">
        <UserRoleBadge :role="account.role" />
        <UIcon class="text-muted size-4" name="i-lucide-chevron-right" />
      </span>
    </button>
  </UCard>
</template>
