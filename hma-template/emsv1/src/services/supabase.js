// Showcase build: there is no Supabase project behind this app. This module
// keeps the same default export the services expect (`supabase.from(...)`,
// `.storage`, `.rpc`, `.functions`, `.auth`) but serves everything from the
// fictional seed data in ./mock/seed, held in memory and persisted to
// localStorage so edits survive a reload. `resetDemoData()` restores the seed.
import { QueryBuilder } from './mock/engine'
import { buildSeed, SEED_VERSION } from './mock/seed'

const DB_KEY = 'hma_demo_db'
const LOCAL_USER_KEY = 'hma_local_user'

const loadDb = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(DB_KEY))
    if (saved?.version === SEED_VERSION && saved.tables) return saved.tables
  } catch {
    // fall through to a fresh seed
  }
  return buildSeed()
}

const currentActor = () => {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_USER_KEY)) || {}
  } catch {
    return {}
  }
}

// Stand-in for the projects_select row-level-security policy: management roles
// see every project; Associates and Officers only the projects they own.
const FULL_PROJECT_ACCESS = ['Admin', 'CEO', 'Heads', 'HR', 'Project Coordinator']

const visibleRows = (table, rows, db) => {
  if (table !== 'projects') return rows
  const actor = currentActor()
  if (FULL_PROJECT_ACCESS.includes(actor.role)) return rows
  const me = db.employees.find((e) => e.employee_id === actor.employee_id)
  if (!me) return []
  const assigned = new Set(
    db.project_officer_assignments.filter((a) => a.employee_id === me.id).map((a) => a.project_id),
  )
  return rows.filter((p) => p.project_associate_id === me.id || assigned.has(p.id))
}

const engine = {
  db: loadDb(),
  visibleRows,
  timer: null,
  persist() {
    clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      try {
        localStorage.setItem(DB_KEY, JSON.stringify({ version: SEED_VERSION, tables: this.db }))
      } catch {
        // Quota exceeded or storage blocked — the in-memory copy still works.
      }
    }, 300)
  },
}

export const resetDemoData = () => {
  clearTimeout(engine.timer)
  try {
    localStorage.removeItem(DB_KEY)
  } catch {
    // ignore
  }
  window.location.reload()
}

// ── storage: uploaded files live in memory for the session only ──────────────

const files = new Map() // "bucket/path" → File
const objectUrls = new Map()

const storageBucket = (bucket) => ({
  async upload(path, file) {
    files.set(`${bucket}/${path}`, file)
    objectUrls.delete(`${bucket}/${path}`)
    return { data: { path }, error: null }
  },
  async remove(paths) {
    paths.forEach((p) => files.delete(`${bucket}/${p}`))
    return { data: [], error: null }
  },
  async createSignedUrl(path) {
    const key = `${bucket}/${path}`
    const file = files.get(key)
    if (!file) {
      return {
        data: null,
        error: { message: 'Demo build: only files uploaded this session can be opened.' },
      }
    }
    if (!objectUrls.has(key)) objectUrls.set(key, URL.createObjectURL(file))
    return { data: { signedUrl: objectUrls.get(key) }, error: null }
  },
  getPublicUrl(path) {
    const file = files.get(`${bucket}/${path}`)
    return { data: { publicUrl: file ? URL.createObjectURL(file) : null } }
  },
  async download(path) {
    const file = files.get(`${bucket}/${path}`)
    return file
      ? { data: file, error: null }
      : { data: null, error: { message: 'File not available in the demo build.' } }
  },
})

// ── edge functions & RPCs ────────────────────────────────────────────────────

const DEMO_AI_NOTE =
  'AI assistant is disabled in the showcase build (no cloud model is connected). ' +
  'In the full product this answers questions about projects, payroll and attendance.'

const functions = {
  async invoke(name) {
    if (name === 'bedrock-chat')
      return { data: { reply: DEMO_AI_NOTE, narrative: DEMO_AI_NOTE }, error: null }
    // apportionment-engine: pool adjustments are pre-seeded, nothing to recompute.
    return { data: { ok: true }, error: null }
  },
}

const rpc = async (name, args = {}) => {
  if (name === 'log_manual_audit_entry') {
    const actor = currentActor()
    ;(engine.db.audit_logs ||= []).push({
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      entry_kind: 'manual',
      action: 'INSERT',
      actor_employee_id: actor.employee_id || null,
      actor_name: actor.full_name || 'Demo User',
      actor_role: actor.role || null,
      table_name: args.p_module,
      action_label: args.p_action,
      record_id: args.p_record_id,
      record_label: args.p_record_label,
      old_data: args.p_old_value,
      new_data: args.p_new_value,
      details: args.p_details,
    })
    engine.persist()
  }
  return { data: null, error: null }
}

const auth = {
  async signInWithPassword() {
    return { data: {}, error: null }
  },
  async signInWithIdToken() {
    return { data: {}, error: null }
  },
  async signOut() {
    return { error: null }
  },
  async getSession() {
    return { data: { session: null }, error: null }
  },
}

const supabase = {
  from: (table) => new QueryBuilder(engine, table),
  storage: { from: storageBucket },
  functions,
  rpc,
  auth,
}

export default supabase
