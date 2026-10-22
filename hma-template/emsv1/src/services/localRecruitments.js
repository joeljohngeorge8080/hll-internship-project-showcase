// Supabase-backed store for the Recruitment & Training module (migrated from
// localStorage — see ADR-037). Keeps the same external shape (list/get/
// create/update/delete) so RecruitmentPage.jsx only needs to handle these
// calls being async now.
import supabase from './supabase'

const throwIfError = (error, message) => {
  if (error) throw new Error(`${message}: ${error.message}`)
}

export const localRecruitments = {
  async list({ search = '', status = '', payment_status = '', activity_type = '' } = {}) {
    let query = supabase.from('recruitments').select('*')
    if (status) query = query.eq('status', status)
    if (payment_status) query = query.eq('payment_status', payment_status)
    if (activity_type) query = query.eq('activity_type', activity_type)
    if (search) {
      const q = search.replace(/[%,]/g, '')
      query = query.or(`candidate_name.ilike.%${q}%,position.ilike.%${q}%,department.ilike.%${q}%`)
    }
    query = query.order('candidate_name', { ascending: true })
    const { data, error } = await query
    throwIfError(error, 'Failed to load recruitment records')
    return data || []
  },

  async get(id) {
    const { data, error } = await supabase
      .from('recruitments')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    throwIfError(error, 'Failed to load recruitment record')
    if (!data) throw new Error('Recruitment not found')
    return data
  },

  async create(data) {
    const { data: inserted, error } = await supabase
      .from('recruitments')
      .insert({
        activity_type: data.activity_type === 'training' ? 'training' : 'recruitment',
        candidate_name: data.candidate_name.trim(),
        position: data.position?.trim() || null,
        department: data.department?.trim() || null,
        date_applied: data.date_applied || null,
        interview_date: data.interview_date || null,
        status: data.status || 'Applied',
        amount_received: parseFloat(data.amount_received) || 0,
        amount_receivable: parseFloat(data.amount_receivable) || 0,
        payment_status: data.payment_status || 'Pending',
        remarks: data.remarks?.trim() || null,
      })
      .select()
      .single()
    throwIfError(error, 'Failed to create recruitment record')
    return inserted
  },

  async bulkCreate(records) {
    if (!records || !records.length) return []
    const mapped = records.map((data) => ({
      activity_type: data.activity_type === 'training' ? 'training' : 'recruitment',
      candidate_name: data.candidate_name.trim(),
      position: data.position?.trim() || null,
      department: data.department?.trim() || null,
      date_applied: data.date_applied || null,
      interview_date: data.interview_date || null,
      status: data.status || 'Applied',
      amount_received: parseFloat(data.amount_received) || 0,
      amount_receivable: parseFloat(data.amount_receivable) || 0,
      payment_status: data.payment_status || 'Pending',
      remarks: data.remarks?.trim() || null,
    }))
    const { data: inserted, error } = await supabase
      .from('recruitments')
      .insert(mapped)
      .select()
    throwIfError(error, 'Failed to bulk create recruitment records')
    return inserted
  },

  async update(id, patch) {
    const { data: updated, error } = await supabase
      .from('recruitments')
      .update({
        ...patch,
        amount_received: parseFloat(patch.amount_received) || 0,
        amount_receivable: parseFloat(patch.amount_receivable) || 0,
      })
      .eq('id', id)
      .select()
      .maybeSingle()
    throwIfError(error, 'Failed to update recruitment record')
    if (!updated) throw new Error('Recruitment not found')
    return updated
  },

  async delete(id) {
    const { error } = await supabase.from('recruitments').delete().eq('id', id)
    throwIfError(error, 'Failed to delete recruitment record')
  },
}
