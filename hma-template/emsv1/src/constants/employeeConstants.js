/**
 * employeeConstants.js — Shared employee-related constants used across the app.
 *
 * Designations are the canonical list of roles HMA uses. Any component that
 * renders a designation picker must import from here so changes propagate
 * everywhere automatically.
 */

export const DESIGNATIONS = [
  'Accounts Assistant',
  'Administrative Assistant (HR)',
  'Administrative Assistant (Projects)',
  'Backend Support',
  'CEO (HMA)',
  'Cleaning Staff',
  'Deputy Manager (Finance)',
  'Field Assistant',
  'Housekeeping Staff',
  'HR Assistant',
  'HR Assistant (SAP-HR)',
  'Manager (Public Health Projects)',
  'Office Assistant',
  'Procurement Associate',
  'Project Associate (Community Development)',
  'Project Associate (Public Health)',
  'Project Coordinator (HMA)',
  'Project Facilitator',
  'Project Lead (HMA)',
  'Project Officer',
  'Project Officer (Community Development)',
  'Project Officer (Public Health)',
  'Project Officer (IT)',
  'Senior Accounts Officer',
  'Senior Project Officer',
  'Student Counsellor',
]

// Must match exactly what EmployeeForm writes to employee_employment.department —
// EmployeeList's filter does an exact-value match against this, so a stray
// casing/spelling difference here silently breaks filtering (Issue: Staff List
// department filter, Aug 2026).
export const DEPARTMENTS = ['SDP', 'FINANCE', 'HR', 'HLL MANAGEMENT', 'UTILITY STAFF', 'OTHER']
