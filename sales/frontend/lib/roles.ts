export const ROLE_ID = {
  superAdmin: 1,
  staff: 2,
  admin: 3,
} as const;

export const getRoleName = (roleId: number | undefined) => {
  switch (roleId) {
    case ROLE_ID.superAdmin:
      return "SuperAdmin";
    case ROLE_ID.admin:
      return "Admin";
    case ROLE_ID.staff:
      return "Staff";
    default:
      return "Unknown role";
  }
};

export const isAdminRole = (roleId: number | undefined) =>
  roleId === ROLE_ID.superAdmin || roleId === ROLE_ID.admin;
