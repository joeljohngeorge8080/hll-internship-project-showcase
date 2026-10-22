// Company holiday store, backed by the `holidays` Supabase table (see
// supabase/migrations/00000000000008_attendance.sql, RLS added in
// 00000000000047_attendance_supabase_migration.sql). Default holidays (all
// Sundays, 2nd & 4th Saturdays) are computed by getDefaultHoliday — a pure
// function, not stored, and deliberately kept synchronous since
// localAttendance.js's saveImport policy step calls it per-row without
// wanting to await a network round trip for a date-math rule. Only custom
// HR-added holidays are persisted, and every CRUD method for those is async.
import supabase from './supabase'

const uid = () => crypto.randomUUID()
const now = () => new Date().toISOString()
const pad = (n) => String(n).padStart(2, '0')

const throwIfError = (error, message) => {
  if (error) throw new Error(`${message}: ${error.message}`)
}

// Returns default holiday info for a date string, or null if it's a working day.
const getDefaultHoliday = (dateStr) => {
  const d = new Date(dateStr + 'T00:00:00')
  const dow = d.getDay()
  if (dow === 0) return { type: 'sunday', name: 'Sunday' }
  if (dow === 6) {
    const nth = Math.ceil(d.getDate() / 7)
    if (nth === 2) return { type: 'saturday', name: '2nd Saturday' }
    if (nth === 4) return { type: 'saturday', name: '4th Saturday' }
  }
  return null
}

const fromDbHoliday = (row) => ({
  id: row.id,
  date: row.holiday_date,
  name: row.name,
  year: row.year,
  month: row.month,
  created_at: row.created_at,
})

export const localHolidays = {
  // ── default rule helper ────────────────────────────────────────────
  getDefaultHoliday,

  // ── custom holiday CRUD ────────────────────────────────────────────
  async listCustom({ year, month } = {}) {
    let query = supabase.from('holidays').select('*').order('holiday_date', { ascending: true })
    if (year != null) query = query.eq('year', Number(year))
    if (month != null) query = query.eq('month', Number(month))
    const { data, error } = await query
    throwIfError(error, 'Failed to load holidays')
    return (data || []).map(fromDbHoliday)
  },

  async addHoliday({ date, name }) {
    const { data: existing } = await supabase
      .from('holidays')
      .select('id')
      .eq('holiday_date', date)
      .maybeSingle()
    if (existing) throw new Error('A custom holiday already exists for this date.')

    const d = new Date(date + 'T00:00:00')
    const { data, error } = await supabase
      .from('holidays')
      .insert({
        id: uid(),
        holiday_date: date,
        name: (name || '').trim() || 'Holiday',
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        created_at: now(),
      })
      .select()
      .single()
    throwIfError(error, 'Failed to add holiday')
    return fromDbHoliday(data)
  },

  async deleteHoliday(id) {
    const { error } = await supabase.from('holidays').delete().eq('id', id)
    throwIfError(error, 'Failed to delete holiday')
  },

  async updateHoliday(id, { name }) {
    const { data, error } = await supabase
      .from('holidays')
      .update({ name: (name || '').trim() || undefined })
      .eq('id', id)
      .select()
      .single()
    throwIfError(error, 'Failed to update holiday')
    if (!data) throw new Error('Holiday not found')
    return fromDbHoliday(data)
  },

  // ── month holiday map ──────────────────────────────────────────────
  // Returns { 'YYYY-MM-DD': { type: 'sunday'|'saturday'|'custom', name, id? } }
  // for every holiday in the given month (defaults + custom).
  async getMonthMap(year, month) {
    const daysInMonth = new Date(year, month, 0).getDate()
    const { data, error } = await supabase
      .from('holidays')
      .select('*')
      .eq('year', Number(year))
      .eq('month', Number(month))
    throwIfError(error, 'Failed to load holidays')
    const customByDate = {}
    for (const h of data || []) {
      customByDate[h.holiday_date] = { type: 'custom', name: h.name, id: h.id }
    }
    const map = {}
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${pad(month)}-${pad(d)}`
      const def = getDefaultHoliday(dateStr)
      if (def) map[dateStr] = def
      else if (customByDate[dateStr]) map[dateStr] = customByDate[dateStr]
    }
    return map
  },

  // Returns holiday info for a single date (default first, then custom), or null.
  async getHoliday(dateStr) {
    const def = getDefaultHoliday(dateStr)
    if (def) return def
    const { data } = await supabase
      .from('holidays')
      .select('*')
      .eq('holiday_date', dateStr)
      .maybeSingle()
    return data ? { type: 'custom', name: data.name, id: data.id } : null
  },
}
