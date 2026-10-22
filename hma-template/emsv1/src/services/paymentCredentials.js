// Supabase-backed store for the "Payments" tab's shared service logins —
// currently just the billing-only AWS IAM user (see
// supabase/migrations/00000000000059_payment_credentials.sql). RLS restricts
// this table to admin/hr, tighter than the rest of Expense Management, so a
// non-HR/Admin viewer's select simply returns no row rather than an error.
// No DB audit trigger on this table (would leak the password into Audit
// Logs, which broader Expense Management roles can read) — update() logs a
// generic localAudit entry instead, with no credential values in it.

import supabase from './supabase'
import { localAudit } from './localAudit'

const throwIfError = (error, message) => {
  if (error) throw new Error(`${message}: ${error.message}`)
}

export const paymentCredentials = {
  async get(service) {
    const { data, error } = await supabase
      .from('payment_credentials')
      .select('*')
      .eq('service', service)
      .maybeSingle()
    throwIfError(error, 'Failed to load credentials')
    return data
  },

  async upsert(service, { login_url, username, password, notes }) {
    const { data, error } = await supabase
      .from('payment_credentials')
      .upsert({ service, login_url, username, password, notes }, { onConflict: 'service' })
      .select()
      .single()
    throwIfError(error, 'Failed to save credentials')
    localAudit.write({
      module: 'Payments',
      action: 'CREDENTIALS_UPDATED',
      record_id: service,
      record_label: service.toUpperCase(),
      details: `${service.toUpperCase()} billing credentials updated`,
    })
    return data
  },
}
