import api from './api'
import { getUserByEmail } from './localUsers'
import supabase from './supabase'

const DEV_USERS = {
  DEV000: {
    employee_id: 'DEV000',
    full_name: 'Dev Admin',
    role: 'Admin',
    google_email: 'admin@hma.dev',
  },
  DEV001: { employee_id: 'DEV001', full_name: 'Dev CEO', role: 'CEO', google_email: 'ceo@hma.dev' },
  DEV002: {
    employee_id: 'DEV002',
    full_name: 'Dev Head',
    role: 'Heads',
    google_email: 'head@hma.dev',
  },
  DEV003: { employee_id: 'DEV003', full_name: 'Dev HR', role: 'HR', google_email: 'hr@hma.dev' },
  DEV005: {
    employee_id: 'DEV005',
    full_name: 'Dev Project Officer',
    role: 'Project Officer',
    google_email: 'po@hma.dev',
  },
  DEV009: {
    employee_id: 'EMP2408',
    full_name: 'Tina Joseph',
    role: 'Employee',
    google_email: 'dev009@hma.dev',
  },
  // ── Project Coordinator + Project Associates ─────────────────────────────────
  DEV_PC1: {
    employee_id: 'PC001',
    full_name: 'Maya Krishnan (PC)',
    role: 'Project Coordinator',
    google_email: 'pc1@hma.dev',
  },
  DEV_PA1: {
    employee_id: 'PA001',
    full_name: 'Rahul Menon (PA)',
    role: 'Project Associate',
    google_email: 'pa1@hma.dev',
  },
  DEV_PA2: {
    employee_id: 'PA002',
    full_name: 'Anil Varghese (PA)',
    role: 'Project Associate',
    google_email: 'pa2@hma.dev',
  },
}

const isDevMode = () => import.meta.env.DEV || import.meta.env.VITE_DEV_LOGIN === 'true'

const LOCAL_USER_KEY = 'hma_local_user'

const decodeGoogleJwt = (credential) => {
  try {
    return JSON.parse(atob(credential.split('.')[1]))
  } catch {
    return null
  }
}

/**
 * Called after Google returns a credential (ID token).
 * Checks the locally-registered user whitelist first. If the Google
 * account's email is found, creates a local session without a backend
 * round-trip (all app data is localStorage-based). Falls back to the
 * backend for accounts pre-seeded there directly.
 */
export const loginWithGoogle = (credential) => {
  if (isDevMode() && credential?.startsWith('dev-bypass-')) {
    const roleKey = credential.replace('dev-bypass-', '')
    const user = DEV_USERS[roleKey]
    if (user) {
      return Promise.resolve({
        data: { access_token: `dev-token-${roleKey}`, user },
      })
    }
  }

  const payload = decodeGoogleJwt(credential)
  const email = payload?.email?.toLowerCase()
  if (email) {
    const registered = getUserByEmail(email)
    if (registered) {
      const user = {
        employee_id: registered.id,
        full_name: registered.full_name,
        role: registered.role,
        google_email: registered.google_email,
      }
      const token = `local-${Date.now()}`
      localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user))
      return Promise.resolve({ data: { access_token: token, user } })
    }
  }

  return api.post('/auth/google', { credential })
}

export const getMeApi = () => {
  const token = localStorage.getItem('hma_token')

  if (isDevMode() && token?.startsWith('dev-token-')) {
    const user = DEV_USERS[token.replace('dev-token-', '')]
    return user ? Promise.resolve({ data: user }) : Promise.reject(new Error('Invalid dev token'))
  }

  if (token?.startsWith('local-')) {
    try {
      const user = JSON.parse(localStorage.getItem(LOCAL_USER_KEY))
      return user
        ? Promise.resolve({ data: user })
        : Promise.reject(new Error('Local session expired'))
    } catch {
      return Promise.reject(new Error('Local session corrupted'))
    }
  }

  return api.get('/auth/me')
}

export const logoutApi = () => {
  localStorage.removeItem(LOCAL_USER_KEY)
  supabase.auth.signOut().catch(() => {})
  return api.post('/auth/logout').catch(() => {})
}
