// In-browser stand-in for the supabase-js client used by the showcase build.
// Implements the slice of the PostgREST query builder the app actually calls
// (select/insert/update/upsert/delete, filters, embeds, count) over plain
// arrays, so every service in src/services keeps working unmodified.
import { RELATIONS, PRIMARY_KEYS, UNIQUE_COLUMNS } from './relations'

const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)))
const uuid = () => crypto.randomUUID()
const nowIso = () => new Date().toISOString()

// ── select-string parsing ────────────────────────────────────────────────────

const splitTop = (str, sep = ',') => {
  const parts = []
  let depth = 0
  let cur = ''
  for (const ch of str) {
    if (ch === '(') depth += 1
    if (ch === ')') depth -= 1
    if (ch === sep && depth === 0) {
      parts.push(cur)
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) parts.push(cur)
  return parts.map((p) => p.trim()).filter(Boolean)
}

/** "*, employee_contacts(*), employees!fk!inner(id)" → { star, cols, embeds } */
const parseSelect = (select) => {
  const node = { star: false, cols: [], embeds: [] }
  for (const item of splitTop(select || '*')) {
    const open = item.indexOf('(')
    if (open === -1) {
      if (item === '*') node.star = true
      else node.cols.push(item.split('::')[0])
      continue
    }
    let head = item.slice(0, open)
    const inner = item.slice(open + 1, item.lastIndexOf(')'))
    let alias = null
    if (head.includes(':')) [alias, head] = head.split(':')
    const [table, ...hints] = head.split('!')
    node.embeds.push({
      table,
      alias: alias || table,
      inner: hints.includes('inner'),
      node: parseSelect(inner),
    })
  }
  return node
}

// ── filters ──────────────────────────────────────────────────────────────────

const looseEq = (a, b) => {
  if (a == null || b == null) return a == null && b == null
  return String(a) === String(b)
}

const compare = (a, b) => {
  const an = Number(a)
  const bn = Number(b)
  if (a !== '' && b !== '' && !Number.isNaN(an) && !Number.isNaN(bn)) return an - bn
  return String(a).localeCompare(String(b))
}

const likeToRegExp = (pattern, flags) => {
  const escaped = String(pattern)
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/%/g, '.*')
    .replace(/_/g, '.')
  return new RegExp(`^${escaped}$`, flags)
}

const OPS = {
  eq: (v, x) => looseEq(v, x),
  neq: (v, x) => !looseEq(v, x),
  gt: (v, x) => v != null && compare(v, x) > 0,
  gte: (v, x) => v != null && compare(v, x) >= 0,
  lt: (v, x) => v != null && compare(v, x) < 0,
  lte: (v, x) => v != null && compare(v, x) <= 0,
  like: (v, x) => v != null && likeToRegExp(x).test(String(v)),
  ilike: (v, x) => v != null && likeToRegExp(x, 'i').test(String(v)),
  is: (v, x) => (x === null || x === 'null' ? v == null : looseEq(v, x)),
  in: (v, x) => (Array.isArray(x) ? x : []).some((item) => looseEq(v, item)),
  contains: (v, x) => Array.isArray(v) && (Array.isArray(x) ? x : [x]).every((i) => v.includes(i)),
}

const parseOrValue = (op, raw) => {
  if (op === 'in') return splitTop(raw.replace(/^\(|\)$/g, '')).map((s) => s.replace(/^"|"$/g, ''))
  if (op === 'is') return raw === 'null' ? null : raw
  return raw
}

/** "a.ilike.%x%,b.eq.1" → predicate(row) */
const parseOr = (expr) => {
  const preds = splitTop(expr).map((part) => {
    const [col, op, ...rest] = part.split('.')
    const fn = OPS[op]
    const val = parseOrValue(op, rest.join('.'))
    return (row) => (fn ? fn(row[col], val) : false)
  })
  return (row) => preds.some((p) => p(row))
}

// ── embeds ───────────────────────────────────────────────────────────────────

const resolveEmbed = (db, tableName, row, embed) => {
  const rel = RELATIONS[tableName]?.[embed.table]
  if (!rel) return undefined
  const target = db[embed.table] || []
  let value
  if (rel.kind === 'parent') {
    const hit = target.find((r) => looseEq(r.id, row[rel.col]))
    value = hit ? hit : null
  } else {
    const hits = target.filter((r) => looseEq(r[rel.col], row.id))
    value = rel.kind === 'one' ? hits[0] || null : hits
  }
  if (value == null) return value
  const shape = (r) => project(db, embed.table, r, embed.node)
  return Array.isArray(value) ? value.map(shape) : shape(value)
}

const project = (db, tableName, row, node) => {
  const out = {}
  if (node.star) Object.assign(out, row)
  for (const col of node.cols) out[col] = row[col]
  for (const embed of node.embeds) {
    out[embed.alias] = resolveEmbed(db, tableName, row, embed)
  }
  return clone(out)
}

// ── builder ──────────────────────────────────────────────────────────────────

class QueryBuilder {
  constructor(engine, table) {
    this.engine = engine
    this.table = table
    this.op = 'select'
    this.selectStr = '*'
    this.countMode = null
    this.head = false
    this.filters = []
    this.orders = []
    this.rangeFrom = null
    this.rangeTo = null
    this.limitN = null
    this.payload = null
    this.returning = false
    this.upsertOpts = {}
    this.mode = 'many' // many | single | maybeSingle
  }

  select(cols = '*', opts = {}) {
    if (this.op === 'select') {
      this.selectStr = cols || '*'
      this.countMode = opts.count || null
      this.head = Boolean(opts.head)
    } else {
      this.returning = true
      this.selectStr = cols || '*'
    }
    return this
  }

  insert(rows) {
    this.op = 'insert'
    this.payload = rows
    return this
  }

  update(patch) {
    this.op = 'update'
    this.payload = patch
    return this
  }

  upsert(rows, opts = {}) {
    this.op = 'upsert'
    this.payload = rows
    this.upsertOpts = opts
    return this
  }

  delete() {
    this.op = 'delete'
    return this
  }

  _f(fn) {
    this.filters.push(fn)
    return this
  }

  _col(col, fn) {
    if (!col.includes('.')) return this._f((row) => fn(row[col]))
    // Filter on an embedded table's column (e.g. 'employee_employment.department').
    const [embedName, embedCol] = col.split('.')
    return this._f((row) => {
      const embedded = row[embedName]
      const items = Array.isArray(embedded) ? embedded : embedded ? [embedded] : []
      return items.some((r) => fn(r[embedCol]))
    })
  }

  eq(col, v) {
    return this._col(col, (x) => OPS.eq(x, v))
  }
  neq(col, v) {
    return this._col(col, (x) => OPS.neq(x, v))
  }
  gt(col, v) {
    return this._col(col, (x) => OPS.gt(x, v))
  }
  gte(col, v) {
    return this._col(col, (x) => OPS.gte(x, v))
  }
  lt(col, v) {
    return this._col(col, (x) => OPS.lt(x, v))
  }
  lte(col, v) {
    return this._col(col, (x) => OPS.lte(x, v))
  }
  like(col, v) {
    return this._col(col, (x) => OPS.like(x, v))
  }
  ilike(col, v) {
    return this._col(col, (x) => OPS.ilike(x, v))
  }
  is(col, v) {
    return this._col(col, (x) => OPS.is(x, v))
  }
  in(col, vals) {
    return this._col(col, (x) => OPS.in(x, vals))
  }
  contains(col, v) {
    return this._col(col, (x) => OPS.contains(x, v))
  }

  not(col, op, v) {
    const fn = OPS[op]
    return this._col(col, (x) => !fn(x, v))
  }

  match(obj) {
    Object.entries(obj).forEach(([k, v]) => this.eq(k, v))
    return this
  }

  filter(col, op, v) {
    const fn = OPS[op]
    return this._col(col, (x) => fn(x, v))
  }

  or(expr) {
    return this._f(parseOr(expr))
  }

  order(col, { ascending = true, nullsFirst } = {}) {
    this.orders.push({ col, ascending, nullsFirst })
    return this
  }

  range(from, to) {
    this.rangeFrom = from
    this.rangeTo = to
    return this
  }

  limit(n) {
    this.limitN = n
    return this
  }

  single() {
    this.mode = 'single'
    return this
  }

  maybeSingle() {
    this.mode = 'maybeSingle'
    return this
  }

  then(resolve, reject) {
    return Promise.resolve()
      .then(() => this._run())
      .then(resolve, reject)
  }

  // Applies filters over rows that already carry their embeds, so filters on
  // embedded columns (`employee_employment.department`) can see them.
  _matching(db, tableRows, node) {
    const wide = { ...node, embeds: node.embeds }
    const withEmbeds = tableRows.map((row) => ({
      row,
      view: {
        ...row,
        ...Object.fromEntries(
          wide.embeds.map((e) => [e.alias, resolveEmbed(db, this.table, row, e)]),
        ),
      },
    }))
    return withEmbeds
      .filter(({ view }) => this.filters.every((f) => f(view)))
      .filter(({ view }) =>
        node.embeds.every(
          (e) => !e.inner || (Array.isArray(view[e.alias]) ? view[e.alias].length : view[e.alias]),
        ),
      )
      .map(({ row }) => row)
  }

  _finish(rows, count) {
    let data = rows
    if (this.mode === 'single') {
      if (data.length !== 1) {
        return {
          data: null,
          error: {
            code: 'PGRST116',
            message: 'JSON object requested, multiple (or no) rows returned',
          },
          count,
        }
      }
      data = data[0]
    } else if (this.mode === 'maybeSingle') {
      if (data.length > 1) {
        return { data: null, error: { code: 'PGRST116', message: 'Multiple rows returned' }, count }
      }
      data = data[0] || null
    }
    return { data, error: null, count }
  }

  _run() {
    const { db } = this.engine
    const rows = (db[this.table] ||= [])
    switch (this.op) {
      case 'select':
        return this._select(db, rows)
      case 'insert':
        return this._insert(db, rows)
      case 'upsert':
        return this._upsert(db, rows)
      case 'update':
        return this._update(db, rows)
      case 'delete':
        return this._delete(db, rows)
      default:
        return { data: null, error: { message: `Unsupported operation ${this.op}` } }
    }
  }

  _select(db, rows) {
    const node = parseSelect(this.selectStr)
    const visible = this.engine.visibleRows ? this.engine.visibleRows(this.table, rows, db) : rows
    let hits = this._matching(db, visible, node)
    for (const { col, ascending, nullsFirst } of [...this.orders].reverse()) {
      hits = [...hits].sort((a, b) => {
        const av = a[col]
        const bv = b[col]
        if (av == null && bv == null) return 0
        if (av == null) return (nullsFirst ?? !ascending) ? -1 : 1
        if (bv == null) return (nullsFirst ?? !ascending) ? 1 : -1
        return ascending ? compare(av, bv) : compare(bv, av)
      })
    }
    const count = this.countMode ? hits.length : null
    if (this.rangeFrom != null) hits = hits.slice(this.rangeFrom, this.rangeTo + 1)
    if (this.limitN != null) hits = hits.slice(0, this.limitN)
    if (this.head) return { data: null, error: null, count }
    const shaped = hits.map((r) => project(db, this.table, r, node))
    return this._finish(shaped, count)
  }

  _checkUnique(rows, candidate, ignore) {
    for (const col of UNIQUE_COLUMNS[this.table] || []) {
      if (candidate[col] == null) continue
      if (rows.some((r) => r !== ignore && looseEq(r[col], candidate[col]))) {
        return {
          code: '23505',
          message: `duplicate key value violates unique constraint "${this.table}_${col}_key"`,
        }
      }
    }
    return null
  }

  _prepare(row) {
    const out = { ...clone(row) }
    if (!PRIMARY_KEYS[this.table] && out.id == null) out.id = uuid()
    if (!('created_at' in out)) out.created_at = nowIso()
    return out
  }

  _returnRows(db, rows) {
    if (!this.returning) return { data: null, error: null }
    const node = parseSelect(this.selectStr)
    return this._finish(
      rows.map((r) => project(db, this.table, r, node)),
      null,
    )
  }

  _insert(db, rows) {
    const list = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((r) =>
      this._prepare(r),
    )
    for (const candidate of list) {
      const error = this._checkUnique(rows, candidate)
      if (error) return { data: null, error }
    }
    rows.push(...list)
    this.engine.persist()
    return this._returnRows(db, list)
  }

  _conflictKey() {
    const raw = this.upsertOpts.onConflict
    if (raw) return raw.split(',').map((s) => s.trim())
    return [PRIMARY_KEYS[this.table] || 'id']
  }

  _upsert(db, rows) {
    const keys = this._conflictKey()
    const touched = []
    for (const incoming of Array.isArray(this.payload) ? this.payload : [this.payload]) {
      const existing =
        keys && keys.every((k) => incoming[k] != null)
          ? rows.find((r) => keys.every((k) => looseEq(r[k], incoming[k])))
          : null
      if (existing) {
        Object.assign(existing, clone(incoming))
        touched.push(existing)
      } else {
        const fresh = this._prepare(incoming)
        rows.push(fresh)
        touched.push(fresh)
      }
    }
    this.engine.persist()
    return this._returnRows(db, touched)
  }

  _update(db, rows) {
    const hits = this._matching(db, rows, { star: true, cols: [], embeds: [] })
    for (const row of hits) {
      Object.assign(row, clone(this.payload))
      if ('updated_at' in row && !('updated_at' in this.payload)) row.updated_at = nowIso()
    }
    this.engine.persist()
    return this._returnRows(db, hits)
  }

  _delete(db, rows) {
    const hits = new Set(this._matching(db, rows, { star: true, cols: [], embeds: [] }))
    const removed = rows.filter((r) => hits.has(r))
    db[this.table] = rows.filter((r) => !hits.has(r))
    // Mirror ON DELETE CASCADE for the child tables the app embeds.
    for (const [childTable, rel] of Object.entries(RELATIONS[this.table] || {})) {
      if (rel.kind === 'parent') continue
      db[childTable] = (db[childTable] || []).filter(
        (c) => !removed.some((r) => looseEq(c[rel.col], r.id)),
      )
    }
    this.engine.persist()
    return this._returnRows(db, removed)
  }
}

export { QueryBuilder, parseSelect }
