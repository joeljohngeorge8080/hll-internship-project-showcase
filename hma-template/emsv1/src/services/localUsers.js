import { ROLES, ROLE } from '../constants/roles'

const STORAGE_KEY = 'hma_registered_users'

// These users are always present regardless of what's in localStorage.
// The id must stay fixed so duplicates are not created on subsequent loads.
const SEEDED_USERS = [
  {
    id: 'USR000',
    full_name: 'HMA Admin',
    google_email: 'admin@example.com',
    role: ROLE.ADMIN,
    added_by: 'system',
    added_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'DEV_ADMIN_001',
    full_name: 'Developer Admin 1',
    google_email: 'dev.admin1@example.com',
    role: ROLE.ADMIN,
    added_by: 'system',
    added_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'DEV_ADMIN_002',
    full_name: 'Developer Admin 2',
    google_email: 'dev.admin2@example.com',
    role: ROLE.ADMIN,
    added_by: 'system',
    added_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'DEV_ADMIN_003',
    full_name: 'Developer Admin 3',
    google_email: 'dev.admin3@example.com',
    role: ROLE.ADMIN,
    added_by: 'system',
    added_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'DEV_ADMIN_004',
    full_name: 'Developer Admin 4',
    google_email: 'dev.admin4@example.com',
    role: ROLE.ADMIN,
    added_by: 'system',
    added_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'DEV_ADMIN_005',
    full_name: 'Developer Admin 5',
    google_email: 'dev.admin5@example.com',
    role: ROLE.ADMIN,
    added_by: 'system',
    added_at: '2026-01-01T00:00:00.000Z',
  },
  // ── Project Coordinator + Project Associates ────────────────────────────
  {
    id: 'PC_DEMO_001',
    full_name: 'Maya Krishnan',
    google_email: 'pc1@hma.dev',
    role: ROLE.PROJECT_COORDINATOR,
    added_by: 'system',
    added_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'PA_DEMO_001',
    full_name: 'Rahul Menon',
    google_email: 'pa1@hma.dev',
    role: ROLE.PROJECT_ASSOCIATE,
    added_by: 'system',
    added_at: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'PA_DEMO_002',
    full_name: 'Anil Varghese',
    google_email: 'pa2@hma.dev',
    role: ROLE.PROJECT_ASSOCIATE,
    added_by: 'system',
    added_at: '2026-01-01T00:00:00.000Z',
  },
]

const load = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const stored = raw ? JSON.parse(raw) : []
    // Always merge seeded users so they survive localStorage clears and fresh deploys
    const storedIds = new Set(stored.map((u) => u.id))
    const missing = SEEDED_USERS.filter((u) => !storedIds.has(u.id))
    return [...missing, ...stored]
  } catch {
    return SEEDED_USERS
  }
}

const save = (users) => localStorage.setItem(STORAGE_KEY, JSON.stringify(users))

export const getRegisteredUsers = () => load()

export const addRegisteredUser = (user) => {
  const users = load()
  const exists = users.some((u) => u.google_email.toLowerCase() === user.google_email.toLowerCase())
  if (exists) throw new Error('A user with this Google email is already registered.')
  const newUser = {
    id: `USR${Date.now()}`,
    full_name: user.full_name,
    google_email: user.google_email.toLowerCase().trim(),
    role: user.role,
    employee_id: user.employee_id || null,
    added_by: user.added_by || 'admin',
    added_at: new Date().toISOString(),
  }
  save([...users, newUser])
  return newUser
}

export const removeRegisteredUser = (id) => {
  const users = load().filter((u) => u.id !== id)
  save(users)
}

export const isEmailRegistered = (email) =>
  load().some((u) => u.google_email === email?.toLowerCase())

export const getUserByEmail = (email) =>
  load().find((u) => u.google_email === email?.toLowerCase()) || null

export const ASSIGNABLE_ROLES = ROLES.filter((r) => r !== ROLE.ADMIN)
