// Supabase-backed LSGB revenue ledger (see
// supabase/migrations/00000000000079_lsgb_revenue_credits.sql). Finance (the
// 'heads' role, displayed as "Finance") adds money to LSGB as individual
// dated entries; the sanctioned balance is the sum of every entry.
// localOrgPool.js nets it against getLsgbRevenueUsed() to produce the
// "LSGB Revenue available" figure shown in the Book Expense modal.
import supabase from './supabase'

const throwIfError = (error, message) => {
  if (error) throw new Error(`${message}: ${error.message}`)
}

export const localLsgbRevenue = {
  // Kept as `get()` returning `{ balance }` so existing consumers
  // (GlobalHRPoolPage, RevenuePage, ReportsPage, LsgbRevenuePage) don't need
  // to change — balance is now derived, not stored.
  async get() {
    const { data, error } = await supabase.from('lsgb_revenue_credits').select('amount')
    throwIfError(error, 'Failed to load LSGB revenue balance')
    const balance = (data || []).reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
    return { balance: Math.round(balance * 100) / 100 }
  },

  // Every individual "money added to LSGB" entry, oldest-first — the inflow
  // side of the combined inflow/outflow ledger.
  async listCredits() {
    const { data, error } = await supabase
      .from('lsgb_revenue_credits')
      .select('*')
      .order('credit_date', { ascending: true })
    throwIfError(error, 'Failed to load LSGB revenue credits')
    return data || []
  },

  async addCredit({ amount, credit_date, month, year, notes }, createdBy) {
    const { data, error } = await supabase
      .from('lsgb_revenue_credits')
      .insert({
        amount: parseFloat(amount) || 0,
        credit_date,
        month,
        year,
        notes: notes || null,
        created_by: createdBy || null,
      })
      .select()
      .single()
    throwIfError(error, 'Failed to add LSGB revenue credit')
    return data
  },
}
