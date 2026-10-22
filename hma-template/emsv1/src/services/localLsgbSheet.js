// Supabase-backed store for the single LSGB spreadsheet, edited via Univer
// (https://github.com/dream-num/univer — see supabase/migrations/00000000000040_lsgb_sheet.sql
// and 00000000000043_lsgb_sheet_univer_snapshot.sql). The sheet is stored as
// Univer's own IWorkbookData snapshot (FWorkbook.save()) so formulas,
// multiple sheets, merges and styles round-trip losslessly.
import supabase from './supabase'

const SHEET_ID = '00000000-0000-0000-0000-000000000001'

const throwIfError = (error, message) => {
  if (error) throw new Error(`${message}: ${error.message}`)
}

export const localLsgbSheet = {
  async get() {
    const { data, error } = await supabase
      .from('lsgb_sheet')
      .select('*')
      .eq('id', SHEET_ID)
      .maybeSingle()
    throwIfError(error, 'Failed to load LSGB sheet')
    return data
  },

  async saveSnapshot({ sheetName, snapshot, uploadedBy }) {
    const { data, error } = await supabase
      .from('lsgb_sheet')
      .upsert({
        id: SHEET_ID,
        sheet_name: sheetName || 'LSGB Projects',
        snapshot,
        uploaded_at: new Date().toISOString(),
        uploaded_by: uploadedBy || null,
      })
      .select()
      .single()
    throwIfError(error, 'Failed to save LSGB sheet')
    return data
  },
}
