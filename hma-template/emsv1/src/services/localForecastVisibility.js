// Forecast Expense tab display preferences, backed by the `forecast_visibility`
// Supabase table (see supabase/migrations/00000000000067_forecast_visibility.sql).
// Lets HR hide a line item from the forecast (cards/totals/WMA) without
// touching the underlying expense record, and opt an existing Admin
// Expenses vendor entry into the Forecast Expense view.
// Row keys: 'admin:<entryId>' or 'general:<vendor>|<expenseName>'
// Single global row (id is always true), same singleton pattern as admin_settings.
import supabase from './supabase'

const ROW_ID = true

const throwIfError = (error, message) => {
  if (error) throw new Error(`${message}: ${error.message}`)
}

const getRow = async () => {
  const { data, error } = await supabase
    .from('forecast_visibility')
    .select('*')
    .eq('id', ROW_ID)
    .maybeSingle()
  throwIfError(error, 'Failed to load forecast visibility')
  return data || { hidden: [], included: [], range_start: null, range_end: null }
}

const upsertRow = async (patch) => {
  const current = await getRow()
  const next = { ...current, ...patch, id: ROW_ID }
  const { error } = await supabase.from('forecast_visibility').upsert(next)
  throwIfError(error, 'Failed to update forecast visibility')
  return next
}

export const localForecastVisibility = {
  async get() {
    const row = await getRow()
    return { hidden: row.hidden || [], included: row.included || [] }
  },

  /** Persisted 'From' / 'To' month range HR picked for the forecast. */
  async getRange() {
    const row = await getRow()
    return row.range_start && row.range_end ? { start: row.range_start, end: row.range_end } : null
  },

  async setRange(start, end) {
    await upsertRow({ range_start: start, range_end: end })
  },

  async hide(rowKey) {
    const row = await getRow()
    if (!row.hidden?.includes(rowKey)) {
      await upsertRow({ hidden: [...(row.hidden || []), rowKey] })
    }
  },

  async unhide(rowKey) {
    const row = await getRow()
    await upsertRow({ hidden: (row.hidden || []).filter((k) => k !== rowKey) })
  },

  async include(rowKey) {
    const row = await getRow()
    if (!row.included?.includes(rowKey)) {
      await upsertRow({ included: [...(row.included || []), rowKey] })
    }
  },
}
