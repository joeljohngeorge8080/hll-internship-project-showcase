// Supabase-backed daily report store — migrated from localStorage
// ('hma_daily_reports_v2'; see supabase/migrations/00000000000076_daily_reports.sql).
// Mirrors the DRD Report Object schema the local store already used, and
// keeps the exact same exported function names/shapes so callers only need
// to add `await` — every method here is now async where it wasn't before.
import supabase from './supabase'
import { localTasks } from './localTasks'

const throwIfError = (error, message) => {
  if (error) throw new Error(`${message}: ${error.message}`)
}

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

const now = () => new Date().toISOString()

export const REPORT_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  DECLINED: 'declined',
  RESUBMITTED: 'resubmitted',
  APPROVED: 'approved',
  SETTLED: 'settled',
  REPORT_SUBMITTED: 'report_submitted',
}

const fromDbRow = (row) => ({
  id: row.id,
  report_type: row.report_type,
  submitted_by: row.submitted_by || '',
  submitted_by_name: row.submitted_by_name || '',
  submitted_at: row.submitted_at,
  bill_topic: row.bill_topic || '',
  amount: parseFloat(row.amount) || 0,
  report_date: row.report_date,
  report_time: row.report_time || '',
  notes: row.notes || '',
  geo_photos: row.geo_photos || [],
  bill_uploads: row.bill_uploads || [],
  meetings: row.meetings || undefined,
  task_id: row.task_id,
  task_title: row.task_title || '',
  requested_status: row.requested_status,
  status: row.status,
  decline_reason: row.decline_reason,
  reviewed_by: row.reviewed_by,
  reviewed_at: row.reviewed_at,
  forwarded_to_backend_at: row.forwarded_to_backend_at,
  settled_at: row.settled_at,
  created_at: row.created_at,
  updated_at: row.updated_at,
})

const getRow = async (id) => {
  const { data, error } = await supabase
    .from('daily_reports')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  throwIfError(error, 'Failed to load report')
  if (!data) throw new Error('Report not found')
  return data
}

export const localReports = {
  // ── list ────────────────────────────────────────────────────────────────────
  async list({
    search = '',
    status = '',
    personnel = '',
    dateFrom = '',
    dateTo = '',
    page = 1,
    pageSize = 25,
  } = {}) {
    let query = supabase.from('daily_reports').select('*', { count: 'exact' })

    if (search) {
      const q = search.replace(/[%,]/g, '')
      query = query.or(
        `bill_topic.ilike.%${q}%,submitted_by_name.ilike.%${q}%,task_title.ilike.%${q}%`,
      )
    }
    if (status) query = query.eq('status', status)
    if (personnel) query = query.eq('submitted_by', personnel)
    if (dateFrom) query = query.gte('report_date', dateFrom)
    if (dateTo) query = query.lte('report_date', dateTo)

    query = query
      .order('submitted_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })

    const start = (page - 1) * pageSize
    query = query.range(start, start + pageSize - 1)

    const { data, error, count } = await query
    throwIfError(error, 'Failed to load reports')

    const total = count || 0
    const total_pages = Math.max(1, Math.ceil(total / pageSize))
    return { items: (data || []).map(fromDbRow), total, total_pages }
  },

  // ── getById ─────────────────────────────────────────────────────────────────
  async getById(id) {
    const { data, error } = await supabase
      .from('daily_reports')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    throwIfError(error, 'Failed to load report')
    return data ? fromDbRow(data) : null
  },

  // ── create (submit) ─────────────────────────────────────────────────────────
  async create(data) {
    const ts = now()
    const { data: record, error } = await supabase
      .from('daily_reports')
      .insert({
        id: data.id || uid(),
        report_type: 'expense',
        submitted_by: data.submitted_by || 'current_user',
        submitted_by_name: data.submitted_by_name || 'Field Personnel',
        submitted_at: ts,
        bill_topic: data.bill_topic,
        amount: parseFloat(data.amount) || 0,
        report_date: data.report_date || ts.split('T')[0],
        report_time: data.report_time || ts.split('T')[1]?.slice(0, 5) || '09:00',
        notes: data.notes || '',
        geo_photos: data.geo_photos || [],
        bill_uploads: data.bill_uploads || [],
        task_id: data.task_id || null,
        task_title: data.task_title || '',
        status: REPORT_STATUS.SUBMITTED,
      })
      .select('*')
      .single()
    throwIfError(error, 'Failed to submit report')
    return fromDbRow(record)
  },

  // ── saveDraft ───────────────────────────────────────────────────────────────
  async saveDraft(data) {
    const ts = now()
    const payload = {
      report_type: 'expense',
      submitted_by: data.submitted_by || 'current_user',
      submitted_by_name: data.submitted_by_name || 'Field Personnel',
      submitted_at: null,
      bill_topic: data.bill_topic || '',
      amount: parseFloat(data.amount) || 0,
      report_date: data.report_date || ts.split('T')[0],
      report_time: data.report_time || '',
      notes: data.notes || '',
      geo_photos: data.geo_photos || [],
      bill_uploads: data.bill_uploads || [],
      task_id: data.task_id || null,
      task_title: data.task_title || '',
      status: REPORT_STATUS.DRAFT,
    }

    if (data.id) {
      const { data: record, error } = await supabase
        .from('daily_reports')
        .update(payload)
        .eq('id', data.id)
        .select('*')
        .maybeSingle()
      throwIfError(error, 'Failed to save draft')
      if (record) return fromDbRow(record)
    }

    const { data: record, error } = await supabase
      .from('daily_reports')
      .insert({ id: data.id || uid(), ...payload })
      .select('*')
      .single()
    throwIfError(error, 'Failed to save draft')
    return fromDbRow(record)
  },

  // ── createTaskReport ────────────────────────────────────────────────────────
  async createTaskReport(data) {
    const ts = now()
    const { data: record, error } = await supabase
      .from('daily_reports')
      .insert({
        id: uid(),
        report_type: 'task',
        submitted_by: data.submitted_by || 'current_user',
        submitted_by_name: data.submitted_by_name || 'Field Personnel',
        submitted_at: ts,
        task_id: data.task_id,
        task_title: data.task_title || '',
        requested_status: data.requested_status || 'active',
        notes: data.notes || '',
        geo_photos: data.geo_photos || [],
        bill_uploads: data.bill_uploads || [],
        status: REPORT_STATUS.SUBMITTED,
      })
      .select('*')
      .single()
    throwIfError(error, 'Failed to submit task report')
    return fromDbRow(record)
  },

  // ── approve ─────────────────────────────────────────────────────────────────
  async approve(id, reviewerId = 'project_officer') {
    const existing = await getRow(id)
    const ts = now()
    const { data: record, error } = await supabase
      .from('daily_reports')
      .update({
        status: REPORT_STATUS.APPROVED,
        reviewed_by: reviewerId,
        reviewed_at: ts,
        forwarded_to_backend_at: ts,
      })
      .eq('id', id)
      .select('*')
      .single()
    throwIfError(error, 'Failed to approve report')

    // If it's a task report, also update the underlying task's status —
    // localTasks.js is still localStorage-backed (out of scope for this
    // migration), so this is a real cross-service call, not a raw storage
    // poke. Never let a failure here block the approval itself.
    if (existing.report_type === 'task' && existing.task_id) {
      try {
        localTasks.update(existing.task_id, { status: existing.requested_status })
      } catch (e) {
        console.error('Failed to update underlying task', e)
      }
    }

    return fromDbRow(record)
  },

  // ── markSettled ─────────────────────────────────────────────────────────────
  async markSettled(id) {
    const existing = await getRow(id)
    if (existing.status !== REPORT_STATUS.APPROVED) {
      throw new Error('Only approved reports can be marked as settled')
    }
    const { data: record, error } = await supabase
      .from('daily_reports')
      .update({ status: REPORT_STATUS.SETTLED, settled_at: now() })
      .eq('id', id)
      .select('*')
      .single()
    throwIfError(error, 'Failed to mark report settled')
    return fromDbRow(record)
  },

  // ── decline ─────────────────────────────────────────────────────────────────
  async decline(id, reviewerId = 'project_officer', reason = '') {
    if (!reason.trim()) throw new Error('Decline reason is required')
    await getRow(id)
    const ts = now()
    const { data: record, error } = await supabase
      .from('daily_reports')
      .update({
        status: REPORT_STATUS.DECLINED,
        decline_reason: reason,
        reviewed_by: reviewerId,
        reviewed_at: ts,
      })
      .eq('id', id)
      .select('*')
      .single()
    throwIfError(error, 'Failed to decline report')
    return fromDbRow(record)
  },

  // ── resubmit ────────────────────────────────────────────────────────────────
  async resubmit(id, data) {
    const existing = await getRow(id)
    const ts = now()

    const payload =
      existing.report_type === 'task'
        ? {
            requested_status: data.requested_status ?? existing.requested_status,
            notes: data.notes ?? existing.notes,
            geo_photos: data.geo_photos ?? existing.geo_photos,
            bill_uploads: data.bill_uploads ?? existing.bill_uploads,
            status: REPORT_STATUS.RESUBMITTED,
            decline_reason: null,
            reviewed_by: null,
            reviewed_at: null,
            submitted_at: ts,
          }
        : {
            bill_topic: data.bill_topic ?? existing.bill_topic,
            amount: data.amount !== undefined ? parseFloat(data.amount) : existing.amount,
            report_date: data.report_date ?? existing.report_date,
            report_time: data.report_time ?? existing.report_time,
            notes: data.notes ?? existing.notes,
            geo_photos: data.geo_photos ?? existing.geo_photos,
            bill_uploads: data.bill_uploads ?? existing.bill_uploads,
            meetings: data.meetings ?? existing.meetings,
            status: REPORT_STATUS.RESUBMITTED,
            decline_reason: null,
            reviewed_by: null,
            reviewed_at: null,
            submitted_at: ts,
          }

    const { data: record, error } = await supabase
      .from('daily_reports')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single()
    throwIfError(error, 'Failed to resubmit report')
    return fromDbRow(record)
  },

  // ── delete (drafts only) ────────────────────────────────────────────────────
  async deleteDraft(id) {
    const existing = await getRow(id)
    if (existing.status !== REPORT_STATUS.DRAFT) {
      throw new Error('Only drafts can be deleted')
    }
    const { error } = await supabase.from('daily_reports').delete().eq('id', id)
    throwIfError(error, 'Failed to delete draft')
  },

  // ── notification counts ─────────────────────────────────────────────────────
  async getNotificationCounts(role = '') {
    if (role === 'Field Personnel') {
      const { count, error } = await supabase
        .from('daily_reports')
        .select('*', { count: 'exact', head: true })
        .eq('status', REPORT_STATUS.DECLINED)
      throwIfError(error, 'Failed to load notification counts')
      return { declined: count || 0, total: count || 0 }
    }
    if (role === 'Project Officer') {
      const { count, error } = await supabase
        .from('daily_reports')
        .select('*', { count: 'exact', head: true })
        .in('status', [REPORT_STATUS.SUBMITTED, REPORT_STATUS.RESUBMITTED])
      throwIfError(error, 'Failed to load notification counts')
      return { pending: count || 0, total: count || 0 }
    }
    return { total: 0 }
  },

  // ── seed demo data ──────────────────────────────────────────────────────────
  async seedDemoData() {
    const { count, error: countErr } = await supabase
      .from('daily_reports')
      .select('*', { count: 'exact', head: true })
    if (countErr || count > 0) return // Don't seed if data exists (or if we can't tell)

    const demoReports = [
      {
        submitted_by: 'fp_001',
        submitted_by_name: 'Rajesh Kumar',
        bill_topic: 'Site Survey — Plot A3 Foundation',
        amount: 2500,
        report_date: '2026-06-17',
        report_time: '10:30',
        notes: 'Completed foundation soil inspection. Photos attached.',
        task_id: 'task_001',
        task_title: 'Plot A3 Foundation Survey',
      },
      {
        submitted_by: 'fp_002',
        submitted_by_name: 'Anita Sharma',
        bill_topic: 'Material Purchase — Cement bags',
        amount: 18500,
        report_date: '2026-06-18',
        report_time: '14:15',
        notes: '50 cement bags for Block B construction phase 2.',
      },
      {
        submitted_by: 'fp_001',
        submitted_by_name: 'Rajesh Kumar',
        bill_topic: 'Transportation — Equipment delivery',
        amount: 4200,
        report_date: '2026-06-18',
        report_time: '09:00',
        notes: 'Heavy equipment delivery from warehouse to site.',
      },
      {
        submitted_by: 'fp_003',
        submitted_by_name: 'Vikram Patel',
        bill_topic: 'Labour Charges — Daily wage workers',
        amount: 12000,
        report_date: '2026-06-19',
        report_time: '17:00',
        notes: '8 workers × ₹1500/day for excavation work.',
        task_id: 'task_002',
        task_title: 'Block C Excavation',
      },
      {
        submitted_by: 'fp_002',
        submitted_by_name: 'Anita Sharma',
        bill_topic: 'Safety Equipment — PPE kits',
        amount: 6800,
        report_date: '2026-06-19',
        report_time: '11:45',
        notes: 'Purchased 20 PPE kits for new site workers. Mandatory safety compliance.',
      },
    ]

    const created = []
    for (const r of demoReports) {
      created.push(await this.create(r))
    }

    // Set some different statuses for demo variety
    if (created.length >= 5) {
      await this.approve(created[0].id, 'po_001')
      await this.decline(
        created[2].id,
        'po_001',
        'Receipt image is blurry. Please re-upload a clear photo of the transport bill.',
      )
    }
  },
}
