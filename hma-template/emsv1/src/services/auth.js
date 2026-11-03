import { ROLE } from '../constants/roles'

// Showcase build: there is no sign-in. Each persona below is a fictional
// staff member from the seed data (employee_id matches services/seedEmployees.json
// so role scoping — PA specialization, officer-assigned projects — resolves
// exactly as it would for a real account).
export const DEMO_PERSONAS = [
  {
    id: 'admin',
    label: 'Admin',
    system: 'EMS + PMS',
    color: 'dark',
    blurb: 'System settings, user access, audit logs and every module.',
    user: {
      employee_id: 'ADMIN001',
      full_name: 'Demo Admin',
      role: ROLE.ADMIN,
      google_email: 'admin@example.com',
    },
  },
  {
    id: 'ceo',
    label: 'CEO',
    system: 'EMS + PMS',
    color: 'primary',
    blurb: 'Organisation-wide dashboards, approvals and executive notes.',
    user: {
      employee_id: 'EMP001',
      full_name: 'Om Verma',
      role: ROLE.CEO,
      google_email: 'ceo@example.com',
    },
  },
  {
    id: 'finance',
    label: 'Finance',
    system: 'EMS',
    color: 'success',
    blurb: 'Expense pools, payroll, GST and budget tracking.',
    user: {
      employee_id: 'EMP002',
      full_name: 'Rohan Verma',
      role: ROLE.HEADS,
      google_email: 'finance@example.com',
    },
  },
  {
    id: 'hr',
    label: 'HR',
    system: 'EMS',
    color: 'info',
    blurb: 'Staff records, attendance, recruitment and internships.',
    user: {
      employee_id: 'EMP004',
      full_name: 'Dev Varma',
      role: ROLE.HR,
      google_email: 'hr@example.com',
    },
  },
  {
    id: 'coordinator',
    label: 'Project Coordinator',
    system: 'PMS',
    color: 'warning',
    blurb: 'Oversees every project and assigns associates and officers.',
    user: {
      employee_id: 'EMP005',
      full_name: 'Maya Krishnan',
      role: ROLE.PROJECT_COORDINATOR,
      google_email: 'pc@example.com',
    },
  },
  {
    id: 'pa-cd',
    label: 'Project Associate — Community Development',
    system: 'PMS',
    color: 'warning',
    blurb: 'Plans budgets and tracks community development projects.',
    user: {
      employee_id: 'EMP2707',
      full_name: 'Rahul Menon',
      role: ROLE.PROJECT_ASSOCIATE,
      google_email: 'pa1@example.com',
    },
  },
  {
    id: 'pa-ph',
    label: 'Project Associate — Public Health',
    system: 'PMS',
    color: 'warning',
    blurb: 'Plans budgets and tracks public health projects.',
    user: {
      employee_id: 'EMP3351',
      full_name: 'Anil Varghese',
      role: ROLE.PROJECT_ASSOCIATE,
      google_email: 'pa2@example.com',
    },
  },
  {
    id: 'officer',
    label: 'Project Officer',
    system: 'PMS',
    color: 'secondary',
    blurb: 'Field view of assigned projects, reports and beneficiaries.',
    user: {
      employee_id: 'EMP2721',
      full_name: 'Rohan Bose',
      role: ROLE.PROJECT_OFFICER,
      google_email: 'po@example.com',
    },
  },
  {
    id: 'employee',
    label: 'Employee',
    system: 'EMS',
    color: 'light',
    blurb: 'Personal profile, attendance and announcements.',
    user: {
      employee_id: 'EMP2408',
      full_name: 'Tina Joseph',
      role: ROLE.EMPLOYEE,
      google_email: 'employee@example.com',
    },
  },
]

const LOCAL_USER_KEY = 'hma_local_user'

/** Restores the persona chosen on the role screen after a page reload. */
export const getMeApi = () => {
  try {
    const user = JSON.parse(localStorage.getItem(LOCAL_USER_KEY))
    return user ? Promise.resolve({ data: user }) : Promise.reject(new Error('No active session'))
  } catch {
    return Promise.reject(new Error('Session corrupted'))
  }
}

export const logoutApi = () => {
  localStorage.removeItem(LOCAL_USER_KEY)
  return Promise.resolve()
}

/**
 * Starts a session as `persona` and lands on `target`. Reloads the page so the
 * per-session caches in the data services (projects, employees) rebuild for
 * the new role instead of leaking the previous role's rows.
 */
export const enterAsPersona = (persona, target) => {
  localStorage.setItem('hma_token', `local-${Date.now()}`)
  localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(persona.user))
  window.location.hash = `#${target}`
  window.location.reload()
}
