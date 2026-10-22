// Supabase-backed beneficiary records (see supabase/migrations/00000000000012_pms_peripheral.sql
// for the beneficiaries/beneficiary_follow_ups tables and 00000000000042_beneficiary_notes.sql
// for the notes column). Previously localStorage-only — additions never reached the database.
import supabase from './supabase'

const throwIfError = (error, message) => {
  if (error) throw new Error(`${message}: ${error.message}`)
}

const SELECT = '*, beneficiary_follow_ups(*)'

const toFollowUpShape = (row) => ({
  id: row.id,
  date: row.follow_up_date,
  note: row.notes || '',
  completed: row.completed || false,
})

const toShape = (row) => ({
  id: row.id,
  project_id: row.project_id,
  name: row.name,
  age: row.age,
  apl_bpl: row.apl_bpl || '',
  place_ward: row.place_ward || '',
  phone: row.phone || '',
  address: row.address || '',
  occupation: row.occupation || '',
  notes: row.notes || '',
  follow_ups: (row.beneficiary_follow_ups || [])
    .slice()
    .sort((a, b) => (a.follow_up_date || '').localeCompare(b.follow_up_date || ''))
    .map(toFollowUpShape),
})

export const localBeneficiaries = {
  async list({ search = '', projectIds = null } = {}) {
    let query = supabase.from('beneficiaries').select(SELECT).order('name')
    if (projectIds) query = query.in('project_id', projectIds)
    if (search) {
      const q = search
      query = query.or(
        `name.ilike.%${q}%,place_ward.ilike.%${q}%,address.ilike.%${q}%,occupation.ilike.%${q}%`,
      )
    }
    const { data, error } = await query
    throwIfError(error, 'Failed to load beneficiaries')
    return (data || []).map(toShape)
  },

  async get(id) {
    const { data, error } = await supabase
      .from('beneficiaries')
      .select(SELECT)
      .eq('id', id)
      .maybeSingle()
    throwIfError(error, 'Failed to load beneficiary')
    if (!data) throw new Error('Beneficiary not found')
    return toShape(data)
  },

  async create(data) {
    const { data: inserted, error } = await supabase
      .from('beneficiaries')
      .insert({
        project_id: data.project_id,
        name: data.name,
        age: data.age || null,
        apl_bpl: data.apl_bpl || null,
        place_ward: data.place_ward || null,
        phone: data.phone || null,
        address: data.address || null,
        occupation: data.occupation || null,
        notes: data.notes || null,
      })
      .select(SELECT)
      .single()
    throwIfError(error, 'Failed to add beneficiary')
    return toShape(inserted)
  },

  async update(id, data) {
    const patch = {}
    const fields = [
      'project_id',
      'name',
      'age',
      'apl_bpl',
      'place_ward',
      'phone',
      'address',
      'occupation',
      'notes',
    ]
    fields.forEach((f) => {
      if (data[f] !== undefined) patch[f] = data[f] === '' ? null : data[f]
    })
    const { data: updated, error } = await supabase
      .from('beneficiaries')
      .update(patch)
      .eq('id', id)
      .select(SELECT)
      .single()
    throwIfError(error, 'Failed to update beneficiary')
    return toShape(updated)
  },

  async remove(id) {
    const { error } = await supabase.from('beneficiaries').delete().eq('id', id)
    throwIfError(error, 'Failed to delete beneficiary')
  },

  async addFollowUp(id, followUp) {
    const { error } = await supabase.from('beneficiary_follow_ups').insert({
      beneficiary_id: id,
      follow_up_date: new Date().toISOString().slice(0, 10),
      notes: followUp.note || '',
      completed: followUp.completed || false,
    })
    throwIfError(error, 'Failed to add follow-up')
    return this.get(id)
  },

  async toggleFollowUp(beneficiaryId, followUpId) {
    const { data: current, error: fetchErr } = await supabase
      .from('beneficiary_follow_ups')
      .select('completed')
      .eq('id', followUpId)
      .single()
    throwIfError(fetchErr, 'Failed to load follow-up')
    const { error } = await supabase
      .from('beneficiary_follow_ups')
      .update({ completed: !current.completed })
      .eq('id', followUpId)
    throwIfError(error, 'Failed to update follow-up')
    return this.get(beneficiaryId)
  },
}
