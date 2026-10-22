-- Monthly Salary Sheet (MonthlySalaryDetailsTab.jsx) lets HR overwrite any
-- auto-calculated CTC breakdown row (Ideal HRA, EPFO, CTC, etc.) instead of
-- only the raw manual inputs. The breakdown itself is still derived fresh
-- via computeEffectiveCTC() on read, so we only need to persist which fields
-- were manually pinned and to what value — one JSONB map, keyed by the same
-- field names computeCTC()/computeEffectiveCTC() return.
alter table salary_details add column if not exists ctc_overrides jsonb not null default '{}'::jsonb;
