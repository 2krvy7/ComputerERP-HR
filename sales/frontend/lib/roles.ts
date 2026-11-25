export const ROLE_ID = {
  superAdmin: 1,
  staff: 2,
  admin: 3,
} as const;

export const isAdminRole = (roleId: number | undefined) =>
  roleId === ROLE_ID.superAdmin || roleId === ROLE_ID.admin;
