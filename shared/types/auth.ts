export const userRoles = ["user", "maintainer", "admin"] as const;

export type UserRole = (typeof userRoles)[number];

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
};
