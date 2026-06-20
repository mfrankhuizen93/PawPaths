import type { UserRole } from "#shared/types/auth";

export function canDeleteLocation(role: UserRole | null | undefined) {
  return role === "admin";
}

export function canSuggestLocationUnavailable(
  role: UserRole | null | undefined,
) {
  return role === "admin" || role === "maintainer";
}
