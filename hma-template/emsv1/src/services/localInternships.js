// Supabase-backed store for the Internship module (migrated from
// localStorage — see ADR-037). Keeps the same external shape (list/get/
// create/update/delete) so InternshipPage.jsx only needs to handle these
// calls being async now.
import supabase from './supabase'

const throwIfError = (error, message) => {
  if (error) throw new Error(`${message}: ${error.message}`)
}

export const localInternships = {
  async list({ search = '', status = '', payment_status = '' } = {}) {
    let query = supabase.from('internships').select('*')
    if (status) query = query.eq('status', status)
    if (payment_status) query = query.eq('payment_status', payment_status)
    if (search) {
      const q = search.replace(/[%,]/g, '')
      query = query.or(`name.ilike.%${q}%,institution.ilike.%${q}%,department.ilike.%${q}%`)
    }
    query = query.order('name', { ascending: true })
    const { data, error } = await query
    throwIfError(error, 'Failed to load internships')
    return data || []
  },

  async get(id) {
    const { data, error } = await supabase
      .from('internships')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    throwIfError(error, 'Failed to load internship')
    if (!data) throw new Error('Internship not found')
    return data
  },

  async create(data) {
    const { data: inserted, error } = await supabase
      .from('internships')
      .insert({
        name: data.name.trim(),
        institution: data.institution?.trim() || null,
        department: data.department?.trim() || null,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        supervisor: data.supervisor?.trim() || null,
        status: data.status || 'Active',
        amount_received: parseFloat(data.amount_received) || 0,
        amount_receivable: parseFloat(data.amount_receivable) || 0,
        payment_status: data.payment_status || 'Pending',
        remarks: data.remarks?.trim() || null,
      })
      .select()
      .single()
    throwIfError(error, 'Failed to create internship')
    return inserted
  },

  async bulkCreate(records) {
    if (!records || !records.length) return []
    const mapped = records.map((data) => ({
      name: data.name.trim(),
      institution: data.institution?.trim() || null,
      department: data.department?.trim() || null,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      supervisor: data.supervisor?.trim() || null,
      status: data.status || 'Active',
      amount_received: parseFloat(data.amount_received) || 0,
      amount_receivable: parseFloat(data.amount_receivable) || 0,
      payment_status: data.payment_status || 'Pending',
      remarks: data.remarks?.trim() || null,
    }))
    const { data: inserted, error } = await supabase
      .from('internships')
      .insert(mapped)
      .select()
    throwIfError(error, 'Failed to bulk create internships')
    return inserted
  },

  async update(id, patch) {
    const { data: updated, error } = await supabase
      .from('internships')
      .update({
        ...patch,
        amount_received: parseFloat(patch.amount_received) || 0,
        amount_receivable: parseFloat(patch.amount_receivable) || 0,
      })
      .eq('id', id)
      .select()
      .maybeSingle()
    throwIfError(error, 'Failed to update internship')
    if (!updated) throw new Error('Internship not found')
    return updated
  },

  async delete(id) {
    const { error } = await supabase.from('internships').delete().eq('id', id)
    throwIfError(error, 'Failed to delete internship')
  },
}
