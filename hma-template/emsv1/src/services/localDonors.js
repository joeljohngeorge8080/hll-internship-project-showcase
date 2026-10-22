// Donor/funding-agency records, backed by the `donors` Supabase table (see
// supabase/migrations/00000000000068_donors.sql).
import supabase from './supabase'

const throwIfError = (error, message) => {
  if (error) throw new Error(`${message}: ${error.message}`)
}

const fromDbDonor = (row) => ({
  id: row.id,
  funding_agency: row.funding_agency,
  location: row.location || '',
  project_id: row.project_id || '',
  project_name: row.project_name || '',
  num_beneficiaries: row.num_beneficiaries || 0,
  project_value: Number(row.project_value) || 0,
  year: row.year,
  start_date: row.start_date || '',
  end_date: row.end_date || '',
  notes: row.notes || '',
  created_at: row.created_at,
  updated_at: row.updated_at,
})

export const localDonors = {
  async list(filters = {}) {
    let query = supabase.from('donors').select('*')
    if (filters.agency) query = query.ilike('funding_agency', `%${filters.agency}%`)
    if (filters.year) query = query.eq('year', Number(filters.year))
    if (filters.location) query = query.ilike('location', `%${filters.location}%`)
    const { data, error } = await query
    throwIfError(error, 'Failed to load donor records')
    let items = (data || []).map(fromDbDonor)

    if (filters.search) {
      const q = filters.search.toLowerCase()
      items = items.filter(
        (d) =>
          d.funding_agency?.toLowerCase().includes(q) ||
          d.project_name?.toLowerCase().includes(q) ||
          d.location?.toLowerCase().includes(q),
      )
    }
    return items.sort(
      (a, b) => b.year - a.year || a.funding_agency?.localeCompare(b.funding_agency),
    )
  },

  async get(id) {
    const { data, error } = await supabase.from('donors').select('*').eq('id', id).maybeSingle()
    throwIfError(error, 'Failed to load donor record')
    return data ? fromDbDonor(data) : null
  },

  async create(data) {
    const { data: row, error } = await supabase
      .from('donors')
      .insert({
        funding_agency: data.funding_agency || '',
        location: data.location || '',
        project_id: data.project_id || null,
        project_name: data.project_name || '',
        num_beneficiaries: Number(data.num_beneficiaries) || 0,
        project_value: Number(data.project_value) || 0,
        year: Number(data.year) || new Date().getFullYear(),
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        notes: data.notes || '',
      })
      .select()
      .single()
    throwIfError(error, 'Failed to create donor record')
    return fromDbDonor(row)
  },

  async update(id, data) {
    const patch = {}
    if (data.funding_agency !== undefined) patch.funding_agency = data.funding_agency
    if (data.location !== undefined) patch.location = data.location
    if (data.project_id !== undefined) patch.project_id = data.project_id || null
    if (data.project_name !== undefined) patch.project_name = data.project_name
    if (data.num_beneficiaries !== undefined)
      patch.num_beneficiaries = Number(data.num_beneficiaries) || 0
    if (data.project_value !== undefined) patch.project_value = Number(data.project_value) || 0
    if (data.year !== undefined) patch.year = Number(data.year)
    if (data.start_date !== undefined) patch.start_date = data.start_date || null
    if (data.end_date !== undefined) patch.end_date = data.end_date || null
    if (data.notes !== undefined) patch.notes = data.notes

    const { data: row, error } = await supabase
      .from('donors')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    throwIfError(error, 'Failed to update donor record')
    if (!row) throw new Error('Donor record not found')
    return fromDbDonor(row)
  },

  async remove(id) {
    const { error } = await supabase.from('donors').delete().eq('id', id)
    throwIfError(error, 'Failed to delete donor record')
  },

  // Unique agencies for filter dropdowns / grouping
  async getAgencies() {
    const items = await this.list()
    const seen = new Set()
    return items
      .map((d) => d.funding_agency)
      .filter((a) => a && !seen.has(a) && seen.add(a))
      .sort()
  },

  async getYears() {
    const items = await this.list()
    const seen = new Set()
    return items
      .map((d) => d.year)
      .filter((y) => y && !seen.has(y) && seen.add(y))
      .sort((a, b) => b - a)
  },

  // Group all records by funding agency
  async groupByAgency() {
    const items = await this.list()
    const groups = {}
    items.forEach((d) => {
      const key = d.funding_agency || 'Unknown'
      if (!groups[key])
        groups[key] = { name: key, records: [], totalValue: 0, totalBeneficiaries: 0 }
      groups[key].records.push(d)
      groups[key].totalValue += parseFloat(d.project_value) || 0
      groups[key].totalBeneficiaries += parseInt(d.num_beneficiaries) || 0
    })
    return Object.values(groups).sort((a, b) => b.totalValue - a.totalValue)
  },

  async getSummary() {
    const items = await this.list()
    const agencies = new Set(items.map((d) => d.funding_agency).filter(Boolean))
    return {
      total: items.length,
      uniqueAgencies: agencies.size,
      totalFunds: items.reduce((s, d) => s + (parseFloat(d.project_value) || 0), 0),
      totalBeneficiaries: items.reduce((s, d) => s + (parseInt(d.num_beneficiaries) || 0), 0),
    }
  },
}
