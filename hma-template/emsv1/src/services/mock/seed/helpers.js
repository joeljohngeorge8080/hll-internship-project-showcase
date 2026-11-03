// Deterministic ids and date helpers shared by the seed builders. Dates are
// anchored to "today" so the demo always shows a current month of activity.

/** Stable UUID-shaped id: the namespace is FNV-hashed so any string is safe. */
export const sid = (ns, n) => {
  let h = 0x811c9dc5
  for (const c of ns) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193)
  return `${(h >>> 0).toString(16).padStart(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`
}

const pad = (n) => String(n).padStart(2, '0')

export const today = () => new Date()

export const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** First day of the month `offset` months from now, as 'YYYY-MM-01'. */
export const monthStart = (offset = 0) => {
  const d = today()
  const m = new Date(d.getFullYear(), d.getMonth() + offset, 1)
  return isoDate(m)
}

export const monthParts = (offset = 0) => {
  const d = new Date(today().getFullYear(), today().getMonth() + offset, 1)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

/** Date `days` from today as 'YYYY-MM-DD'. */
export const daysFromNow = (days) => {
  const d = today()
  d.setDate(d.getDate() + days)
  return isoDate(d)
}

export const isoNow = () => new Date().toISOString()
