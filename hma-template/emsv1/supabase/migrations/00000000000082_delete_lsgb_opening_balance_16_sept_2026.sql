-- Migration 00000000000082: Delete LSGB opening balance entry from 16 Sept 2026.
-- Removes the mistaken opening balance entry (₹87,01,580 inflow) that was
-- migrated from single-balance entry on 2026-09-16 in lsgb_revenue_credits.
-- This entry was auto-inserted by the ledger migration; delete it if no longer needed.

delete from lsgb_revenue_credits
where id = 'bf68b016-e46c-4ec9-96ea-8e55a56f14c8';
