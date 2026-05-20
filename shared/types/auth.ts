export const userRoles = ["user", "maintainer", "admin"] as const;

export type UserRole = (typeof userRoles)[number];

export type AuthUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  image: string | null;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
};
