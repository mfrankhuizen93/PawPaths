import type { NavigationMenuItem } from "@nuxt/ui/components/NavigationMenu.vue";

export const footerNavigationItems = [
  {
    label: "Explore",
    icon: "i-lucide-map-pin",
    active: true,
  },
  {
    label: "Saved",
    icon: "i-lucide-heart",
  },
  {
    label: "Add",
    icon: "i-lucide-circle-plus",
  },
  {
    label: "Profile",
    icon: "i-lucide-circle-user-round",
  },
] satisfies NavigationMenuItem[];

export const headerNavigationItems = [
  ...footerNavigationItems,
] satisfies NavigationMenuItem[];
