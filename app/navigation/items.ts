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
