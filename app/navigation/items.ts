import type { NavigationMenuItem } from "@nuxt/ui/components/NavigationMenu.vue";

const baseNavigationItems = [
  {
    label: "Explore",
    icon: "i-lucide-map-pin",
    to: "/",
  },
] satisfies NavigationMenuItem[];

export function getAppNavigationItems(options: {
  isAdmin: boolean;
  isMaintainer: boolean;
  pendingContributions: number | null;
}) {
  return [
    ...baseNavigationItems,
    ...(options.isMaintainer
      ? [
          getAdminNavigationItems({
            isAdmin: options.isAdmin,
            pendingContributions: options.pendingContributions,
          }).submissionsItem,
        ]
      : []),
    ...(options.isAdmin
      ? [
          {
            label: "Users",
            icon: "i-lucide-users",
            to: "/admin/users",
          } satisfies NavigationMenuItem,
        ]
      : []),
  ] satisfies NavigationMenuItem[];
}

export function getAdminNavigationItems(options: {
  isAdmin: boolean;
  pendingContributions: number | null;
}) {
  const submissionsItem = {
    label: "Submissions",
    icon: "i-lucide-inbox",
    to: "/admin/submissions",
    chip:
      options.pendingContributions && options.pendingContributions > 0
        ? {
            text: options.pendingContributions,
            color: "error",
          }
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
