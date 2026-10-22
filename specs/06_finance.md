# Spec 06 — Finance

**Roadmap:** P8 · **Decisions:** ADR-014, 031

## Purpose
A finance workspace for uploading and versioning three finance Excel sheets, with full historical retention and download.

## Entities / Tables

### `finance_files`
| Field | Type | Notes |
|---|---|---|
| id | PK | |
| sheet_number | int | 1, 2, or 3 |
| file_name | string | |
| file_path | string | S3 |
| uploaded_by | FK → users | |
| uploaded_at | timestamp | |
| remarks | string | |
| version_number | int | increments per sheet |
| is_active | bool | one active version per sheet_number |

### `finance_file_history` (append-only — ADR-014)
`id` · `finance_file_id` · `old_file_name` · `new_file_name` · `changed_by` · `changed_at` · `remarks`

## APIs
| Method | Path | Role | Purpose |
|---|---|---|---|
| GET | `/finance/files` | all (view) | list files/versions |
| POST | `/finance/files/upload` | Finance | upload a sheet version |
| PUT | `/finance/files/{id}` | Finance | update metadata/version |
| GET | `/finance/files/{id}/history` | view | version history |
| GET | `/finance/report` | view | finance report |

## Permissions
| Role | Access |
|---|---|
| Finance | E |
| CEO, Heads, HR | V |
| Project Officer | — |

## Validation rules
- `sheet_number` ∈ {1,2,3}.
- New upload for a sheet → increments `version_number`, sets new row `is_active = true`, previous active → `is_active = false`; writes `finance_file_history`.
- File persisted to S3; `.xlsx` type/size validated.
- Historical versions are never deleted; always downloadable.

## Edge cases
- Concurrent uploads to the same sheet → serialize; last commit wins as active, both retained as versions.
- Download of an old version → served from S3 by `file_path`.
- Non-Finance mutation attempt → 403.
- Corrupt/invalid spreadsheet → reject upload; keep prior active version intact.
