export const adminRole = "admin";
export const superAdminRole = "super-admin";
export const userRole = "user";

export function normalizeRole(role: string) {
  return role.trim().toLowerCase().replace(/[\s_]+/g, "-");
}

export function isAdminRole(role: string) {
  const normalizedRole = normalizeRole(role);

  return normalizedRole === adminRole || normalizedRole === superAdminRole;
}

export function isSuperAdminRole(role: string) {
  return normalizeRole(role) === superAdminRole;
}

export function isAssignableRole(role: string) {
  return !isAdminRole(role);
}
