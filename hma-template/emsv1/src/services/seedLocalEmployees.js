/**
 * seedLocalEmployees.js
 *
 * Pre-populates localStorage with the 73 HMA employees (64 from MANPOWER HMA.xlsx
 * + 9 attendance-only employees) on first app load. Employee IDs now use the Pace
 * attendance THLL format (e.g. EMP2408) so that attendance imports link correctly.
 *
 * Behaviour:
 *  - Runs once per version: if the current seed flag is already set, it does nothing.
 *  - Never overwrites existing employee records — only adds employees whose
 *    employee_id is not already present in the store.
 *  - v2 migration: renames HMA* employee_ids to their THLL equivalents in existing
 *    localStorage data so that any previously-seeded records stay linked correctly.
 *  - Call this once at app startup (before rendering).
 */

import seedData from './seedEmployees.json'

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

const now = () => new Date().toISOString()

const KEY = 'hma_employees'
const SEED_FLAG = 'hma_employees_seeded_v2'
const OLD_FLAG = 'hma_employees_seeded_v1'

// Maps old HMA IDs (from v1 seed) to corrected THLL IDs
const HMA_TO_THLL = {
  EMP010: 'EMP2408',
  EMP011: 'EMP4831',
  EMP012: 'EMP2412',
  EMP013: 'EMP2414',
  EMP014: 'EMP2415',
  EMP015: 'EMP2419',
  EMP016: 'EMP2421',
  EMP017: 'EMP2426',
  EMP018: 'EMP2707',
  EMP019: 'EMP2721',
  EMP020: 'EMP2722',
  EMP021: 'EMP2752',
  EMP022: 'EMP2815',
  EMP024: 'EMP2994',
  EMP025: 'EMP2997',
  EMP027: 'EMP3312',
  EMP028: 'EMP3351',
  EMP029: 'EMP3353',
  EMP030: 'EMP3448',
  EMP033: 'EMP4073',
  EMP041: 'EMP4229',
  EMP042: 'EMP4398',
  EMP044: 'EMP4868',
  EMP045: 'EMP4896',
  EMP046: 'EMP4941',
  EMP047: 'EMP4977',
  EMP049: 'EMP5548',
  EMP050: 'EMP5642',
  EMP052: 'EMP5811',
  EMP053: 'EMP5852',
  EMP054: 'EMP5910',
  EMP055: 'EMP6289',
  EMP056: 'EMP6296',
  EMP058: 'EMP6428',
  EMP059: 'EMP6464',
  EMP060: 'EMP6466',
  EMP061: 'EMP6465',
  EMP062: 'EMP6467',
  EMP063: 'EMP6468',
  EMP064: 'EMP6478',
}

function migrateEmployeeIds(employees) {
  return employees.map((e) => {
    const newId = HMA_TO_THLL[e.employee_id]
    if (!newId) return e
    return {
      ...e,
      employee_id: newId,
      employment: e.employment ? { ...e.employment } : e.employment,
    }
  })
}

function migrateAttendanceIds() {
  try {
    const raw = localStorage.getItem('hma_attendance')
    if (!raw) return
    const data = JSON.parse(raw)
    let changed = false
    const updated = data.map((record) => {
      const newId = HMA_TO_THLL[record.employee_id]
      if (!newId) return record
      changed = true
      return { ...record, employee_id: newId }
    })
    if (changed) localStorage.setItem('hma_attendance', JSON.stringify(updated))
  } catch {
    // silent — attendance migration is best-effort
  }
}

const SALARY_20000_FLAG = 'hma_employees_salary_20000_v1'

/**
 * One-time migration: sets every employee's current_salary to ₹20,000,
 * recording the change in each employee's salary_history (same record
 * shape as localEmployees.updateSalaryDirect) rather than silently
 * overwriting current_salary, per the payroll immutability rule.
 * Runs once per browser (guarded by SALARY_20000_FLAG); call after seedLocalEmployees().
 */
export function applySalary20000Migration() {
  if (localStorage.getItem(SALARY_20000_FLAG)) return // already applied

  try {
    const employees = JSON.parse(localStorage.getItem(KEY) || '[]')
    const ts = now()
    const today = ts.slice(0, 10)

    const updated = employees.map((e) => {
      const previous = parseFloat(e.current_salary || 0)
      const newSalary = 20000
      if (previous === newSalary) return e
      return {
        ...e,
        current_salary: newSalary,
        salary_history: [
          ...(e.salary_history || []),
          {
            id: uid(),
            previous_salary: previous,
            increment_percentage: 0,
            increment_amount: newSalary - previous,
            new_salary: newSalary,
            effective_date: today,
            remarks: 'Bulk salary set to ₹20,000',
            created_at: ts,
          },
        ],
        updated_at: ts,
      }
    })

    localStorage.setItem(KEY, JSON.stringify(updated))
    localStorage.setItem(SALARY_20000_FLAG, '1')
  } catch (err) {
    console.warn('[applySalary20000Migration] Failed to set employee salaries:', err)
  }
}

const CORE_SALARY_SYNC_FLAG = 'hma_core_salary_expenses_synced_20000_v1'
const CORE_SAL_KEY = 'hma_core_salary_expenses'

/**
 * One-time migration: Core Pool "Core Expenses" (modules/ems/core-pool/CorePoolPage.jsx)
 * snapshots an employee's salary into a separate persisted record when they're added
 * as a core overhead expense — it does not read current_salary live afterward. Any
 * entry added before applySalary20000Migration() ran is now stale. This brings existing
 * entries in line with the new ₹20,000 baseline; entries added from now on already
 * snapshot the live (updated) current_salary at add-time, so only pre-existing entries
 * need this one-time correction.
 * Runs once per browser (guarded by CORE_SALARY_SYNC_FLAG); call after applySalary20000Migration().
 */
export function syncCoreSalaryExpenses() {
  if (localStorage.getItem(CORE_SALARY_SYNC_FLAG)) return // already synced

  try {
    const employees = JSON.parse(localStorage.getItem(KEY) || '[]')
    const employeeById = new Map(employees.map((e) => [e.id, e]))

    const entries = JSON.parse(localStorage.getItem(CORE_SAL_KEY) || '[]')
    const updated = entries.map((entry) => {
      const emp = employeeById.get(entry.employee_id)
      if (!emp) return entry
      return { ...entry, salary: parseFloat(emp.current_salary) || 0 }
    })

    localStorage.setItem(CORE_SAL_KEY, JSON.stringify(updated))
    localStorage.setItem(CORE_SALARY_SYNC_FLAG, '1')
  } catch (err) {
    console.warn('[syncCoreSalaryExpenses] Failed to sync core salary expenses:', err)
  }
}

const DESIGNATION_MIGRATION_FLAG = 'hma_employees_designation_po_v1'

export function applyProjectOfficerMigration() {
  if (localStorage.getItem(DESIGNATION_MIGRATION_FLAG)) return
  try {
    const employees = JSON.parse(localStorage.getItem(KEY) || '[]')
    let changed = false
    const updated = employees.map((e) => {
      // The specialized PA designations ("Project Associate (Community Development)" /
      // "Project Associate (Public Health)") are the real, current-generation Project
      // Associate role and must never be rewritten by this legacy migration.
      const isSpecializedPaDesignation =
        e.employment?.designation === 'Project Associate (Community Development)' ||
        e.employment?.designation === 'Project Associate (Public Health)'
      if (
        !isSpecializedPaDesignation &&
        e.employee_name !== 'Rahul Menon' &&
        e.employee_name !== 'Anil Varghese'
      ) {
        if (
          e.employment &&
          e.employment.designation &&
          e.employment.designation.includes('Project Associate')
        ) {
          e.employment.designation = e.employment.designation.replace(
            'Project Associate',
            'Project Officer',
          )
          changed = true
        }
      }
      return e
    })
    if (changed) {
      localStorage.setItem(KEY, JSON.stringify(updated))
    }
    localStorage.setItem(DESIGNATION_MIGRATION_FLAG, '1')
  } catch (err) {
    console.warn('[applyProjectOfficerMigration] Failed:', err)
  }
}

const PA_TO_PO_FLAG = 'hma_employees_designation_pa_to_po_v1'

/**
 * One-time migration: every employee whose designation contains
 * "Project Assistant" becomes a "Project Officer" (suffixes like
 * "(Accounts)" are preserved). Project Officers are always listed under
 * Global Core Pool → Project-Assigned Employees (see CorePoolPage).
 * Runs once per browser (guarded by PA_TO_PO_FLAG); call after
 * applyProjectOfficerMigration().
 */
export function applyProjectAssistantMigration() {
  if (localStorage.getItem(PA_TO_PO_FLAG)) return
  try {
    const employees = JSON.parse(localStorage.getItem(KEY) || '[]')
    let changed = false
    const updated = employees.map((e) => {
      if (e.employment?.designation?.includes('Project Assistant')) {
        changed = true
        return {
          ...e,
          employment: {
            ...e.employment,
            designation: e.employment.designation.replace('Project Assistant', 'Project Officer'),
          },
          updated_at: now(),
        }
      }
      return e
    })
    if (changed) {
      localStorage.setItem(KEY, JSON.stringify(updated))
    }
    localStorage.setItem(PA_TO_PO_FLAG, '1')
  } catch (err) {
    console.warn('[applyProjectAssistantMigration] Failed:', err)
  }
}

export function seedLocalEmployees() {
  if (localStorage.getItem(SEED_FLAG)) return // already on v2

  try {
    let existing = JSON.parse(localStorage.getItem(KEY) || '[]')

    // If this browser had the v1 seed, migrate employee_ids in-place first
    if (localStorage.getItem(OLD_FLAG)) {
      existing = migrateEmployeeIds(existing)
      migrateAttendanceIds()
      localStorage.removeItem(OLD_FLAG)
    }

    const existingIds = new Set(existing.map((e) => e.employee_id))
    const toAdd = seedData.filter((e) => !existingIds.has(e.employee_id))
    if (toAdd.length > 0) {
      localStorage.setItem(KEY, JSON.stringify([...existing, ...toAdd]))
    } else {
      localStorage.setItem(KEY, JSON.stringify(existing))
    }

    localStorage.setItem(SEED_FLAG, '1')
  } catch (err) {
    console.warn('[seedLocalEmployees] Failed to seed employee data:', err)
  }
}

const PA_HIERARCHY_SEED_FLAG = 'hma_employees_pa_hierarchy_seed_v1'

// Demo employee records for the PMS Project Coordinator / Project Associate
// hierarchy, so the dev-login and password-login demo accounts (employee_id
// PC001/PA001/PA002 — see localUsers.js PASSWORD_LOGINS / auth.js DEV_USERS /
// Login.jsx) resolve to a real employee record and specialization instead of
// a dangling employee_id. Runs once per browser; never overwrites an existing
// employee_id.
const PA_HIERARCHY_DEMO_EMPLOYEES = [
  {
    employee_id: 'PC001',
    first_name: 'Anand',
    last_name: 'Krishnan',
    employment: { designation: 'Project Coordinator (HMA)', department: 'SDP' },
  },
  {
    employee_id: 'PA001',
    first_name: 'Priya',
    last_name: 'Menon',
    employment: { designation: 'Project Associate (Community Development)', department: 'SDP' },
  },
  {
    employee_id: 'PA002',
    first_name: 'Rahul',
    last_name: 'Nair',
    employment: { designation: 'Project Associate (Public Health)', department: 'SDP' },
  },
]

export function seedPaHierarchyDemoEmployees() {
  if (localStorage.getItem(PA_HIERARCHY_SEED_FLAG)) return
  try {
    const existing = JSON.parse(localStorage.getItem(KEY) || '[]')
    const existingIds = new Set(existing.map((e) => e.employee_id))
    const ts = now()
    const toAdd = PA_HIERARCHY_DEMO_EMPLOYEES.filter((e) => !existingIds.has(e.employee_id)).map(
      (e) => ({
        id: uid(),
        employee_id: e.employee_id,
        first_name: e.first_name,
        last_name: e.last_name,
        employee_name: `${e.first_name} ${e.last_name}`,
        status: 'Active',
        joined_date: ts.slice(0, 10),
        created_at: ts,
        updated_at: ts,
        contact: { working_email: `${e.employee_id.toLowerCase()}@hma.dev` },
        employment: {
          designation: e.employment.designation,
          department: e.employment.department,
          status: 'Active',
          start_date: ts.slice(0, 10),
        },
      }),
    )
    if (toAdd.length > 0) {
      localStorage.setItem(KEY, JSON.stringify([...existing, ...toAdd]))
    }
    localStorage.setItem(PA_HIERARCHY_SEED_FLAG, '1')
  } catch (err) {
    console.warn('[seedPaHierarchyDemoEmployees] Failed:', err)
  }
}
