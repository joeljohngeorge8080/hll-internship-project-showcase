-- Adds a free-text Notes field to the beneficiary record itself (separate
-- from beneficiary_follow_ups.notes, which is per follow-up entry). Also
-- backs BeneficiaryPage.jsx's move off localStorage onto this real table —
-- the beneficiaries/beneficiary_follow_ups tables already existed but the
-- app was never wired up to read/write them.

alter table beneficiaries
  add column if not exists notes text;

comment on column beneficiaries.notes is 'Free-text note entered when adding/editing the beneficiary';
