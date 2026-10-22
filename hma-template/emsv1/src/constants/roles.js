/**
 * User Role Constants
 *
 * The HMA IEMS roles. Used as the single vocabulary for the
 * permission matrix, sidebar role-gating, and ProtectedRoute checks.
 *
 * PMS hierarchy: PROJECT_COORDINATOR (one person, oversees both
 * specializations) sits above PROJECT_ASSOCIATE (two people, each
 * permanently specialized to one project type via their designation).
 *
 * @module constants/roles
 */

export const ROLE = {
  ADMIN: 'Admin',
  CEO: 'CEO',
  HEADS: 'Heads',
  HR: 'HR',
  PROJECT_COORDINATOR: 'Project Coordinator',
  PROJECT_ASSOCIATE: 'Project Associate',
  PROJECT_OFFICER: 'Project Officer',
  EMPLOYEE: 'Employee',
}

export const ROLES = [
  ROLE.ADMIN,
  ROLE.CEO,
  ROLE.HEADS,
  ROLE.HR,
  ROLE.PROJECT_COORDINATOR,
  ROLE.PROJECT_ASSOCIATE,
  ROLE.PROJECT_OFFICER,
  ROLE.EMPLOYEE,
]

// Display-only relabeling. The Heads role is shown to users as "Finance",
// but ROLE.HEADS itself stays 'Heads' — that value is what's stored in
// employees.role, matched by the Postgres app_role enum, and compared in
// RLS policies (see 00000000000051_auth_profile_provisioning.sql), so
// changing the constant itself would break every existing Heads account.
const ROLE_DISPLAY_OVERRIDES = { [ROLE.HEADS]: 'Finance' }

export const roleDisplayName = (role) => ROLE_DISPLAY_OVERRIDES[role] || role

// Roles that skip the EMS/PMS system-selection screen and land straight in
// one system. Admin/CEO/Project Coordinator/Project Associate still choose.
const DIRECT_SYSTEM_ROUTE = {
  [ROLE.HR]: '/ems/dashboard',
  [ROLE.HEADS]: '/ems/dashboard',
  [ROLE.EMPLOYEE]: '/ems/dashboard',
  [ROLE.PROJECT_OFFICER]: '/pms/dashboard',
}

export const directSystemRouteForRole = (role) => DIRECT_SYSTEM_ROUTE[role] || null
