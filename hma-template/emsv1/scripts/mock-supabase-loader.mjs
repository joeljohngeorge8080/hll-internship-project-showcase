// Node ESM loader hook that intercepts `import supabase from './supabase'`
// (used by every localXxx.js service file) and substitutes an in-memory
// fake Supabase client — the real ./supabase.js reads import.meta.env
// (Vite-only) and would throw under plain Node. Register with
// `module.register(new URL('./mock-supabase-loader.mjs', import.meta.url))`
// before loadEsmSource-ing a service module that imports supabase.
//
// The fake only implements the query shapes localBudgetPlan.js actually
// uses: select().eq().maybeSingle(), insert(), update().eq(), delete().eq().
// Extend it if another verify script needs more of the client surface.

const MOCK_SPECIFIER = 'mock-supabase:client'

export async function resolve(specifier, context, nextResolve) {
  if (specifier === './supabase' || specifier === './supabase.js') {
    return { url: MOCK_SPECIFIER, shortCircuit: true }
  }
  return nextResolve(specifier, context)
}

export async function load(url, context, nextLoad) {
  if (url === MOCK_SPECIFIER) {
    return {
      format: 'module',
      shortCircuit: true,
      source: `
        globalThis.__mockSupabaseStore = globalThis.__mockSupabaseStore || {}
        const store = globalThis.__mockSupabaseStore

        class FakeQuery {
          constructor(table) {
            this.table = table
            this.filters = []
            this.op = null
            this.single = false
          }
          select() { this.op = this.op || 'select'; return this }
          insert(row) { this.op = 'insert'; this.row = row; return this }
          update(patch) { this.op = 'update'; this.patch = patch; return this }
          delete() { this.op = 'delete'; return this }
          eq(col, val) { this.filters.push([col, val]); return this }
          maybeSingle() { this.single = true; return this._exec() }
          then(resolve, reject) { this._exec().then(resolve, reject) }
          async _exec() {
            const rows = store[this.table] || (store[this.table] = [])
            const matches = (r) => this.filters.every(([c, v]) => r[c] === v)
            if (this.op === 'select') {
              const found = rows.filter(matches)
              return this.single ? { data: found[0] || null, error: null } : { data: found, error: null }
            }
            if (this.op === 'insert') {
              const row = { id: 'row_' + Math.random().toString(36).slice(2), ...this.row }
              rows.push(row)
              return { data: [row], error: null }
            }
            if (this.op === 'update') {
              rows.forEach((r) => { if (matches(r)) Object.assign(r, this.patch) })
              return { data: null, error: null }
            }
            if (this.op === 'delete') {
              store[this.table] = rows.filter((r) => !matches(r))
              return { data: null, error: null }
            }
            return { data: null, error: null }
          }
        }

        const client = { from: (table) => new FakeQuery(table) }
        export default client
      `,
    }
  }
  return nextLoad(url, context)
}
