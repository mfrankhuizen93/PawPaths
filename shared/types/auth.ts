export const userRoles = ["user", "maintainer", "admin"] as const;
export const navigationAppPreferences = [
  "device",
  "apple",
  "google",
  "waze",
] as const;

export type UserRole = (typeof userRoles)[number];
export type NavigationAppPreference = (typeof navigationAppPreferences)[number];

export type AuthUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  image: string | null;
  role: UserRole;
  navigationAppPreference: NavigationAppPreference;
  createdAt: string;
  updatedAt: string;
};
