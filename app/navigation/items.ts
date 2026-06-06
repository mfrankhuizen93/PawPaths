import type { NavigationMenuItem } from "@nuxt/ui/components/NavigationMenu.vue";

export const footerNavigationItems = [
  {
    label: "Explore",
    icon: "i-lucide-map-pin",
    to: "/",
  },
  {
    label: "Add",
    icon: "i-lucide-circle-plus",
    to: "/add",
  },
  {
    label: "Profile",
    icon: "i-lucide-circle-user-round",
    to: "/account",
  },
] satisfies NavigationMenuItem[];

export const headerNavigationItems = [
  ...footerNavigationItems,
] satisfies NavigationMenuItem[];

export function getAdminNavigationItems(options: {
  isAdmin: boolean;
  pendingContributions: number | null;
}) {
  const submissionsItem = {
    label: "Submissions",
    icon: "i-lucide-inbox",
    to: "/admin/submissions",
    badge:
      options.pendingContributions && options.pendingContributions > 0
        ? options.pendingContributions
        : undefined,
  } satisfies NavigationMenuItem;

  return {
    submissionsItem,
    adminGroup: {
      label: "Admin",
      icon: "i-lucide-shield",
      defaultOpen: true,
      children: [
        submissionsItem,
        ...(options.isAdmin
          ? [
              {
                label: "Users",
                icon: "i-lucide-users",
                to: "/admin/users",
              },
            ]
          : []),
      ],
    } satisfies NavigationMenuItem,
  };
}
