-- Replaces the flat headers/rows grid format with Univer's native workbook
-- snapshot (IWorkbookData) now that the LSGB sheet editor is Univer
-- (https://github.com/dream-num/univer) instead of a hand-rolled grid.
-- headers/rows are left in place (unused) rather than dropped, so no data
-- is lost — the app just stops reading/writing them.

alter table lsgb_sheet
  add column if not exists snapshot jsonb;

comment on column lsgb_sheet.snapshot is 'Univer IWorkbookData snapshot — the full spreadsheet (sheets, cells, formulas, merges, styles) as Univer''s FWorkbook.save() returns it.';
