// One-off seed script for the 7 dev/demo password-login accounts from
// src/services/localUsers.js's PASSWORD_LOGINS. HMA Admin (the real
// Google-OAuth account) is deliberately excluded — it will be created
// naturally the first time that person signs in via Google through
// Supabase Auth, once the frontend is rewired.
//
// Requires SUPABASE_SERVICE_ROLE_KEY in the environment. Run with:
//   node supabase/seed/seed-users.mjs
import WebSocket from 'ws'
import { createClient } from '@supabase/supabase-js'

// supabase-js always constructs a Realtime client, which needs a native
// WebSocket global — not present on Node 20. Not otherwise used here.
globalThis.WebSocket ??= WebSocket

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://YOUR-PROJECT-REF.supabase.co'
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SERVICE_ROLE_KEY) {
  console.error('Set SUPABASE_SERVICE_ROLE_KEY in your environment before running this script.')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const SEED_ACCOUNTS = [
  {
    email: 'dev.admin1@example.com',
    password: 'Demo-Admin-1',
    full_name: 'Developer Admin 1',
    role: 'admin',
  },
  {
    email: 'dev.admin2@example.com',
    password: 'Demo-Admin-2',
    full_name: 'Developer Admin 2',
    role: 'admin',
  },
  {
    email: 'dev.admin3@example.com',
    password: 'Demo-Admin-3',
    full_name: 'Developer Admin 3',
    role: 'admin',
  },
  {
    email: 'dev.admin4@example.com',
    password: 'Demo-Admin-4',
    full_name: 'Developer Admin 4',
    role: 'admin',
  },
  {
    email: 'dev.admin5@example.com',
    password: 'Demo-Admin-5',
    full_name: 'Developer Admin 5',
    role: 'admin',
  },
  {
    email: 'pc1@hma.dev',
    password: 'Demo-PC-1',
    full_name: 'Maya Krishnan',
    role: 'project_coordinator',
    employee_code: 'EMP005',
  },
  {
    email: 'pa1@hma.dev',
    password: 'Demo-PA-1',
    full_name: 'Rahul Menon',
    role: 'project_associate',
    employee_code: 'EMP2707',
  },
  {
    email: 'pa2@hma.dev',
    password: 'Demo-PA-2',
    full_name: 'Anil Varghese',
    role: 'project_associate',
    employee_code: 'EMP3351',
  },
  // ── Dev quick-login buttons (Login.jsx) — dev/QA only, remove before production deploy ──
  { email: 'dev000@hma.dev', password: 'Demo-Dev-000', full_name: 'Dev Admin', role: 'admin' },
  { email: 'dev001@hma.dev', password: 'Demo-Dev-001', full_name: 'Dev CEO', role: 'ceo' },
  { email: 'dev002@hma.dev', password: 'Demo-Dev-002', full_name: 'Dev Head', role: 'heads' },
  { email: 'dev003@hma.dev', password: 'Demo-Dev-003', full_name: 'Dev HR', role: 'hr' },
  {
    email: 'dev005@hma.dev',
    password: 'Demo-Dev-005',
    full_name: 'Dev Project Officer',
    role: 'project_officer',
  },
  { email: 'dev009@hma.dev', password: 'Demo-Dev-009', full_name: 'Tina Joseph', role: 'employee' },
]

for (const acct of SEED_ACCOUNTS) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: acct.email,
    password: acct.password,
    email_confirm: true,
  })

  if (error) {
    console.error(`✗ auth user ${acct.email}: ${error.message}`)
    continue
  }

  // profiles.employee_id links this auth user to their real Staff & Payroll
  // record — RLS policies (e.g. projects_select's PA/PC row-scoping) key off
  // it via current_employee_id(), so it must be resolved and set up front.
  let employeeId = null
  if (acct.employee_code) {
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select('id')
      .eq('employee_id', acct.employee_code)
      .maybeSingle()
    if (employeeError) {
      console.error(`✗ employee lookup for ${acct.email} (${acct.employee_code}): ${employeeError.message}`)
    } else if (!employee) {
      console.error(`✗ no employee found with employee_id ${acct.employee_code} for ${acct.email}`)
    } else {
      employeeId = employee.id
    }
  }

  const { error: profileError } = await supabase.from('profiles').insert({
    id: data.user.id,
    role: acct.role,
    full_name: acct.full_name,
    google_email: acct.email,
    employee_id: employeeId,
  })

  if (profileError) {
    console.error(`✗ profile for ${acct.email}: ${profileError.message}`)
    continue
  }

  console.log(`✓ ${acct.email} (${acct.role})`)
}
