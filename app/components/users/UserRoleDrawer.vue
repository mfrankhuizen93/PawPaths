<script setup lang="ts">
import type { TabsItem } from "@nuxt/ui/components/Tabs.vue";
import type { AuthUser, UserRole } from "#shared/types/auth";
import AppTabs from "~/components/common/AppTabs.vue";
import AppDrawer from "~/components/drawer/AppDrawer.vue";
import AppDrawerHeader from "~/components/drawer/AppDrawerHeader.vue";
import UserRoleDrawerSkeleton from "~/components/users/UserRoleDrawerSkeleton.vue";

const props = defineProps<{
  open: boolean;
  user: AuthUser | null;
  roleOptions: { label: string; value: UserRole }[];
  saving?: boolean;
}>();

const emit = defineEmits<{
  "update:open": [open: boolean];
  updateRole: [user: AuthUser, role: UserRole];
}>();

const tabs: TabsItem[] = [
  { label: "Profile", slot: "profile", icon: "i-lucide-user" },
  { label: "Access", slot: "permissions", icon: "i-lucide-shield" },
  { label: "Activity", slot: "activity", icon: "i-lucide-history" },
];

const selectedRole = computed({
  get: () => props.user?.role,
  set: (role) => {
    if (props.user && role) emit("updateRole", props.user, role);
  },
});

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

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
  <AppDrawer
    :description="user?.email"
    :open="open"
    stable-height
    :title="user?.name"
    @update:open="$emit('update:open', $event)"
  >
    <template v-if="user" #header>
      <AppDrawerHeader
        description="Inspect the account and manage its access level."
        eyebrow="User account"
        :title="user.name"
      >
        <template #leading>
          <UAvatar
            :alt="user.name"
            :src="user.image || undefined"
            :text="getInitials(user.name, user.email)"
            size="lg"
          />
        </template>
      </AppDrawerHeader>
    </template>

    <UserRoleDrawerSkeleton v-if="!user" />

    <AppTabs v-else :items="tabs">
      <template #profile>
        <dl
          class="border-default grid gap-4 rounded-lg border p-4 sm:grid-cols-2"
        >
          <div>
            <dt class="text-muted text-sm font-medium">Display name</dt>
            <dd class="text-highlighted mt-1">{{ user.name }}</dd>
          </div>
          <div>
            <dt class="text-muted text-sm font-medium">Email</dt>
            <dd class="text-highlighted mt-1 break-all">{{ user.email }}</dd>
          </div>
          <div>
            <dt class="text-muted text-sm font-medium">Email status</dt>
            <dd class="mt-1">
              <UBadge
                :color="user.emailVerified ? 'success' : 'warning'"
                variant="soft"
              >
                {{ user.emailVerified ? "Verified" : "Not verified" }}
              </UBadge>
            </dd>
          </div>
          <div>
            <dt class="text-muted text-sm font-medium">Navigation app</dt>
            <dd class="text-highlighted mt-1 capitalize">
              {{ user.navigationAppPreference }}
            </dd>
          </div>
        </dl>
      </template>

      <template #permissions>
        <div class="flex flex-col gap-4">
          <UFormField
            description="Role changes take effect immediately."
            label="Access level"
          >
            <USelect
              v-model="selectedRole"
              :disabled="saving"
              :items="roleOptions"
              :loading="saving"
              class="w-full"
              :ui="{ value: 'text-base' }"
            />
          </UFormField>

          <UAlert
            color="neutral"
            description="Maintainers can review submissions. Administrators can also manage user roles."
            icon="i-lucide-info"
            title="Permission scope"
            variant="soft"
          />
        </div>
      </template>

      <template #activity>
        <dl
          class="border-default grid gap-4 rounded-lg border p-4 sm:grid-cols-2"
        >
          <div>
            <dt class="text-muted text-sm font-medium">Account created</dt>
            <dd class="text-highlighted mt-1">
              {{ formatDate(user.createdAt) }}
            </dd>
          </div>
          <div>
            <dt class="text-muted text-sm font-medium">Last updated</dt>
            <dd class="text-highlighted mt-1">
              {{ formatDate(user.updatedAt) }}
            </dd>
          </div>
        </dl>
      </template>
    </AppTabs>
  </AppDrawer>
</template>
