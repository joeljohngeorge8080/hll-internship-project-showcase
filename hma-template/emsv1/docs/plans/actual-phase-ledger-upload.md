# Plan — Excel Ledger Upload in the Actual Phase

Status: **draft for review** · Author: Joel John George · Date: 2026-07-20

Project officers keep their project accounts in an Excel workbook (sample:
`docs/Ongoing project summary 2026-2027.xlsx`). They want to upload that sheet
after the plan is submitted, so their real spending lands in the system without
being re-typed. This plan covers where that upload lives, how it is parsed, and
how it is kept separate from manual actual entry.

---

## 1. What the officers' sheet actually looks like

Analysed from the 12-sheet sample workbook, 249 data rows. **One sheet per
project.** Every sheet follows the same shape:

```
R0   Project title
R1-6 Summary block (Project Value, Amount Received, Expenses accounted,
     Fund Balance, Balance Fund after commitment)
R7   HEADER ROW
R8+  Transaction rows
     ...trailing total rows with no Date/Particulars
```

Header row (row index 7 in **all 12** sheets):

| col | header | example |
|-----|--------|---------|
| 0 | `Date` | `27.02.2025`, `15-07-2025` |
| 1 | `Particulars` | `Settlement of advance(Maya Krishnan-Need assessment)` |
| 2 | `Amount` | `" 15,380.00 "` |
| 3 | `Status` | `Accounted` / `Committed` |
| 4 | `Status` | `Paid` |
| 5 | `Budget Head` | `Project Expense` / `HR Expense` / `Coreteam Salary` / `Administrative Expense` |
| 6 | `Phase` | `Design & Initiation Phase` / `Implementation Phase` / `Monitoring & Evaluation Phase` |
| 7 | `Activity` **or** `Activities` **or** `Main Activities` | `Conveyance` |
| 8 | `Remarks` — **or** `Sub Activities` in one sheet | `ADMN/455` |

### Findings that drive the design

These are the real hazards found in the sample. Each one has a corresponding
rule in the parser spec (§4).

1. **The Activity column moves.** In `HLL Wayanad-Navajeevana` the header is
   `Main Activities | Sub Activities`, the `Main Activities` column is
   **entirely empty**, and the real values sit in `Sub Activities` — one column
   to the right of every other sheet.
   → *The parser must locate the activity column by header text, never by a
   fixed index.*

2. **5 of 12 sheets have no Activity column at all** — `Terumo Penpol`,
   `GMCH KONNI-HCD`, `KSRTC-HCD`, `IOCL SERPL ODISHA`, `IOCL ERPL KOLKATA`.
   They have only 1–5 rows each (new projects, barely started).
   → *Upload must fail cleanly with an explanatory message, not a crash.*

3. **Two date formats, both text, both day-first:** `DD-MM-YYYY` (135 rows) and
   `DD.MM.YYYY` (104 rows). No real Excel date cells.
   → *Parse both; reject anything else rather than guessing.*

4. **Activity spellings do not match our dropdown.** Real values in the file:

   | Excel value | count | our `ACTIVITY_OPTIONS` |
   |---|---|---|
   | `Conveyance` | 32 | ✅ exact |
   | `Printing & Stationary` | 27 | ⚠️ we have "Printing and Stationary" |
   | `Trainers Refreshment` | 24 | ✅ exact |
   | `Projec team Salary` | 17 | ⚠️ **typo in source** (missing `t`) |
   | `Courier Charges` | 14 | ✅ exact |
   | `Lodging` | 8 | ✅ exact |
   | `Computer hiring charges` | 8 | ❌ not in list |
   | `Coreteam Salary` | 8 | ❌ not in list |
   | `Procurement of materials` | 7 | ⚠️ case differs |
   | `Inauguration Expense` | 5 | ❌ not in list |
   | `Long Distance Travel` | 3 | ✅ exact |
   | `Rent` | 3 | ❌ not in list |
   | `Beneficiary Refreshment` | 3 | ✅ exact |
   | `Cost of M-Cup` | 2 | ❌ not in list |
   | `Internet Charges` | 2 | ❌ not in list |
   | `Vedio Documentation` | 2 | ⚠️ **typo in source** ("Vedio") |
   | `Courier & Postal` | 1 | ⚠️ variant of Courier Charges |
   | `Long distance travel` | 1 | ⚠️ casing differs from the other 3 |
   | `Digital Information System` | 1 | ✅ exact |

   Note the same logical activity is spelled differently *between sheets*:
   `Projec team Salary` (Powergrid) vs `Project team Salary` (Wayanad).

5. **`Budget Head` has 4 junk values** where someone typed a note into the
   wrong column: `"1179661/-PAID"`, `"20339/-TDS"`,
   `"Paid-10,28,261/- on 18-04-2026"`, `"Rs.1234569.50/- Paid"`.

6. **10 rows have no date**, 23 rows have a nil amount (`" -   "`), and
   81 rows have a blank activity (mostly from the 5 activity-less sheets).

7. **Trailing total rows** appear after the data (e.g. Powergrid R111–R115:
   a bare `1,684,900.00` with no date or particulars).

---

## 2. Goal and non-goals

**Goal.** After a plan is submitted, the PO can upload their project sheet. The
system reads it, groups spend by **month + activity**, and shows those totals in
the Actual phase as a clearly separate block, next to but never merged with the
manually entered actual figures.

**Non-goals (explicitly out of scope):**

- Does not replace or modify manual actual entry.
- Does not feed the settlement / transfer / approval math (see §7).
- Does not import the summary block (rows 1–6) — those are the officer's own
  running totals, and the system computes its own.
- Does not write back to Excel.

---

## 3. Where it lives in the UI

Upload is a **per-project action on the project's Budget Plan panel**, visible
only when `plan.status === 'submitted'` (the actual phase), mirroring how
`RecurringTasksEntry` is gated to the planning phase.

```
BudgetPlanPanel  (plan.status === 'submitted')
├── PlanHeader
├── LedgerUploadPanel        ← NEW: upload + review wizard
├── ActualMonthCard  Jul 2025
│     ├── Manual Actual entry      (existing, untouched)
│     └── Uploaded from Excel      ← NEW: read-only block
├── ActualMonthCard  Aug 2025
└── ...
```

Because the workbook holds 12 projects, after the file is read the wizard shows
the sheet names and asks which one belongs to this project. Auto-matching is
**not** attempted: Excel truncates sheet names to 31 characters
(`"M-CUP PROJECT-POWERGRID-BANGLOR"` is cut mid-word) and one has a trailing
space (`"CPCL-NILGIRIS "`), so name matching would be unreliable and silently
wrong. The PO picks from a list — one click, unambiguous.

### Wizard steps

Mirrors the existing `AttendanceImport.jsx` step pattern.

```
Step 1  Upload file          → drop .xlsx
Step 2  Pick sheet           → list of sheet names + row counts
Step 3  Review               → parsed rows, warnings, activity mapping
          ├── [ Import as-is ]      ← "upload"
          └── [ Edit then import ]  ← "not upload and edit it"
Step 4  Done                 → summary of what was stored
```

Step 3 is where your *"upload or not upload and edit it"* requirement is met —
both paths reach the same commit, one goes through an editable table first.
If any activity is unmatched, "Import as-is" is disabled until those are mapped,
since importing an unmapped activity would silently lose the row.

---

## 4. Parser spec — `src/services/projectLedgerParser.js`

New file, following `attendanceParser.js` conventions exactly: a documented
layout comment block at the top, `import * as XLSX from 'xlsx'`, and a single
exported function returning `{ rows, errors, warnings }`.

```js
export const parseProjectLedgerExcel = (file) => // → Promise
listSheets(file)            // → [{ name, dataRowCount, hasActivityColumn }]
parseSheet(file, sheetName) // → { rows, errors, warnings, meta }
```

### Rules

| # | Rule |
|---|---|
| P1 | Find the header row by scanning for a row whose col 0 trims to `"date"` (found at index 7 in all 12 sheets, but do not hardcode). |
| P2 | Resolve **each column by header text**, case-insensitive, trimmed. Activity column = first header matching `activity` / `activities` / `main activities` / `sub activities`. |
| P3 | **If two activity-ish columns exist** (`Main Activities` + `Sub Activities`), pick the one with more non-empty values in the data rows. In the Wayanad sheet this correctly picks `Sub Activities` (Main is empty). |
| P4 | If no activity column is found → hard error: *"This sheet has no Activity column, so its rows cannot be grouped. Sheets: …"* |
| P5 | Stop at the first row that has neither a date nor particulars nor an activity — drops the trailing total rows. |
| P6 | Date: accept `DD-MM-YYYY` and `DD.MM.YYYY` only, day-first. Also accept a real Excel date cell if present. Anything else → row warning, row excluded. |
| P7 | Amount: strip spaces, commas, `₹`. Treat `-`, `" -   "`, empty as `0`. Non-numeric → row warning, row excluded. |
| P8 | Month key derived from the parsed date as `YYYY-MM`. This is the *"check the month via date"* requirement. |
| P9 | Rows with `Status === 'Committed'` are parsed and stored but flagged `committed: true` and **excluded from totals by default** (10 rows in the sample). A toggle in review can include them. |
| P10 | `Budget Head` is stored verbatim per row but is **not** part of the grouping key (§6). Values not in the known set are kept as-is and flagged — this catches the 4 junk cells without dropping the row. |
| P11 | Phase mapped: `Design & Initiation Phase`→`design`, `Implementation Phase`→`implementation`, `Monitoring & Evaluation Phase`→`monitoring`. Unknown → stored raw, warned. |

### Parsed row shape

```js
{
  rowIndex: 43,              // 1-based Excel row, for error messages
  date: '2025-10-06',
  month: '2025-10',          // grouping key
  particulars: 'Mis Advance Settlement(Maya Krishnan)',
  amount: 3174,
  status: 'Accounted',       // or 'Committed'
  paid: 'Paid',
  budgetHead: 'Project Expense',
  phase: 'implementation',
  activityRaw: 'Conveyance', // exactly as in Excel
  activity: 'conveyance',    // resolved ACTIVITY_OPTIONS value
  remarks: 'SDP/265',
}
```

---

## 5. Activity matching — the primary key

Activity is the join key between the officer's sheet and our system, so
matching has to be forgiving of the real-world spelling problems in §1.4 while
never guessing silently.

**Three-tier resolution:**

1. **Exact** — normalised compare (lowercase, collapse whitespace, `&`→`and`,
   strip punctuation). Catches `Printing & Stationary`,
   `Procurement of materials`, `Long distance travel`.
2. **Alias table** — an explicit, reviewable map for known variants and source
   typos. Lives next to `ACTIVITY_OPTIONS` in `activityOptions.js`:

   ```js
   export const ACTIVITY_ALIASES = {
     'projec team salary': 'project_team_salary',   // typo in source sheets
     'project team salary': 'project_team_salary',
     'vedio documentation': 'video_documentation',  // typo in source sheets
     'courier and postal': 'courier_charges',
     'courier charges': 'courier_charges',
   }
   ```

3. **Unmatched → PO maps it in review.** Shown as a row with a dropdown. The
   chosen mapping is **remembered** (persisted per project) so the next upload
   resolves it automatically.

The 6 activities with no equivalent in our list — `Computer hiring charges`,
`Rent`, `Coreteam Salary`, `Inauguration Expense`, `Cost of M-Cup`,
`Internet Charges` — fall to tier 3. The PO can map each to an existing
activity or to **Other** with the Excel text kept as the custom name (the
`activity_other` field added in commit `339c27a`).

> **Decision to confirm (§11-A):** should these 6 instead be *added* to
> `ACTIVITY_OPTIONS` as first-class activities? `Rent` and
> `Computer hiring charges` recur often enough (8 and 3 rows) that they look
> like real budget lines rather than one-offs.

---

## 6. Aggregation — what gets stored

> *"add the total of the conveyance in that month, total of the refreshment of
> that month. Check the month via date."*

Grouping key is **`month` + `activity`**. Budget Head and Phase are preserved on
each source row but do **not** split the total, so one activity yields exactly
one figure per month.

Worked example, Powergrid sheet, **Feb 2026** (verified against the real file):

| Activity | Source rows | Total |
|---|---|---|
| Conveyance | 3,111 + 6,065 + 124 + 1,287 | **10,587** |
| Trainers Refreshment | 3,294 + 400 + 2,658 | **6,352** |
| Printing & Stationary | 607 + 535 | **1,142** |
| Courier Charges | 480 + 240 | **720** |
| Beneficiary Refreshment | 3,000 | **3,000** |

Note the Conveyance total deliberately mixes a ₹6,065 `HR Expense` row
(18.02.2026, vehicle hire) with three `Project Expense` rows. That is what
"total of the conveyance in that month" means literally.

> **Decision to confirm (§11-B):** your budget plan already treats HR / Core /
> Admin as separate pools with their own caps. If HR-Expense conveyance should
> be its own line rather than merged, the grouping key becomes
> `month + activity + budgetHead`. The raw rows are stored either way, so this
> can be changed later without re-uploading.

### Handles "planning has multiple activities of the same name"

> *"the planning contain multiple activites of same name, and in the actual it
> may not be the same"*

Exactly — so the two sides are compared **as aggregates, never row-to-row**:

- **Planned** side for a month = sum of `planned_amount` across *every* subtask
  in that month whose `activity` is X, however many tasks they are spread over.
- **Uploaded** side = sum of Excel rows in that month whose activity is X.

So three separate planned "Conveyance" subtasks under three different tasks
collapse into one planned Conveyance figure, comparable against the one
uploaded Conveyance figure. No assumption that the two sides have the same
number of lines, or the same names.

---

## 7. Storage — kept separate from manual entry

> *"do not mix the manual entry part of the actual, the uploading part should be
> separate"*

A **standalone store**, not embedded in the plan. This follows the convention
already documented at the top of `localBudgetPlan.js` ("mirrors the
standalone-store convention of `localProjectExpenses.js` rather than embedding
into the project record").

New file `src/services/localProjectLedger.js`, key `hma_project_ledger_v1`:

```js
{
  [projectId]: {
    version: 1,
    uploaded_at: '2026-07-20T…',
    uploaded_by: 'Joel John George',
    source_file: 'Ongoing project summary 2026-2027.xlsx',
    source_sheet: 'M-CUP PROJECT-POWERGRID-BANGLOR',
    rows: [ /* parsed row shape, §4 */ ],
    activity_overrides: { 'rent': 'other:Rent' },   // remembered mappings
  }
}
```

**Why a separate store rather than extra fields on `plan.months[].tasks`:**

1. It is structurally impossible for an upload to corrupt planned or manually
   entered actual figures — different key, different object.
2. `reopenPlanning()`, `resetActualMonth()` and `resetMonth()` already wipe
   actual data in `plan.months`. Uploads must survive those, and here they do,
   with no changes to that logic.
3. Re-upload is a single-key replace, so it cannot half-apply.
4. Deleting an upload is one delete; nothing to unpick.

**Consequence:** `settlementCheck`, `monthActualTotal`, approval and transfer
logic in `budgetPlan.js` are untouched — they never see this data. Uploaded
figures are reporting-only.

> **Decision to confirm (§11-C):** if uploaded spend *should* count as real
> actual spend and drive shortfall/surplus/approval, say so — but note that a
> re-upload would then change the numbers under an already-approved month, so
> we would need to block re-upload once any month is approved.

---

## 8. Display in `ActualMonthCard`

Appended below the existing manual task list, visually separated, read-only:

```
┌─ Feb 2026 ─────────────── Allocated ₹1,20,000 · Actual ₹12,000 ─┐
│                                                                  │
│  [ existing manual task/subtask rows — unchanged ]               │
│                                                                  │
│  ── Uploaded from Excel ──────────────────  ⓘ not in settlement  │
│     Conveyance                 planned  8,000   uploaded 10,587  │
│     Trainers Refreshment       planned  6,000   uploaded  6,352  │
│     Printing & Stationary      planned  1,000   uploaded  1,142  │
│     Courier Charges            planned      —   uploaded    720  │
│     Beneficiary Refreshment    planned  3,000   uploaded  3,000  │
│                                        ───────  ───────────────  │
│                                          18,000          21,801  │
│     Uploaded 20 Jul 2026 · sheet "M-CUP …BANGLOR"  [Remove]      │
└──────────────────────────────────────────────────────────────────┘
```

`planned` is the aggregate from §6. `—` means the activity was spent on but
never planned, which is itself useful information.

---

## 9. Files

**New**
| file | purpose |
|---|---|
| `src/services/projectLedgerParser.js` | Parse the officer's workbook. Pure, returns `{ rows, errors, warnings }`. |
| `src/services/localProjectLedger.js` | Standalone store for uploaded ledgers. |
| `src/modules/pms/project-associate/budget-plan/LedgerUploadPanel.jsx` | 4-step upload/review wizard. |
| `src/modules/pms/project-associate/budget-plan/LedgerMonthBlock.jsx` | The read-only per-month block in §8. |

**Modified**
| file | change |
|---|---|
| `budget-plan/activityOptions.js` | Add `ACTIVITY_ALIASES` + `resolveActivity(raw)`. |
| `BudgetPlanPanel.jsx` | Render `LedgerUploadPanel` when `plan.status === 'submitted'`. |
| `budget-plan/ActualMonthCard.jsx` | Render `LedgerMonthBlock` under the manual rows. |

**Untouched (important):** `budgetPlan.js`, and every settlement / transfer /
approval path. `budgetPlan.js` must additionally stay import-free — its header
comment requires it, since `scripts/load-esm-source.mjs` loads it standalone.

---

## 10. Build sequence

1. `projectLedgerParser.js` + a verify script run against the real sample
   workbook, asserting: 12 sheets listed; Wayanad resolves to the
   `Sub Activities` column; both date formats parse; trailing totals dropped;
   the 5 activity-less sheets error cleanly.
2. `ACTIVITY_ALIASES` + `resolveActivity`, with the §1.4 table as test cases.
3. `localProjectLedger.js` — save / get / remove / aggregate-by-month-activity.
4. `LedgerUploadPanel.jsx` — steps 1–2 (upload, pick sheet).
5. Step 3 review + the two commit paths, including the activity-mapping table.
6. `LedgerMonthBlock.jsx` + wire into `ActualMonthCard`.
7. Verify end-to-end with the sample workbook; `npx eslint` + `npm run build`.

Each step is independently checkable; 1–3 have no UI and can be verified by
script against the real file.

---

## 11. Decisions to confirm before I build

- **A.** Add `Rent`, `Computer hiring charges`, `Coreteam Salary`,
  `Inauguration Expense`, `Cost of M-Cup`, `Internet Charges` to
  `ACTIVITY_OPTIONS` as real options? Or leave them to be mapped to **Other**
  per project? *(My default: leave as Other — keeps the PO-facing dropdown
  short. But `Rent` looks like a genuine recurring line.)*
- **B.** Group by `month + activity` (my default, matches your wording), or
  `month + activity + budgetHead` so HR-Expense conveyance stays separate from
  Project-Expense conveyance?
- **C.** Uploaded totals read-only (my default, matches "keep it separate"), or
  should they drive the settlement/approval math?
- **D.** Rows dated **outside** the plan's month range — Wayanad has May-2026
  rows. My default: import them, flag them in review, show them in a
  "outside plan range" group rather than dropping them silently. OK?
- **E.** Re-upload **replaces** the whole stored ledger for that project (my
  default) rather than merging/appending. OK?

**Defaults I've assumed and will proceed with unless told otherwise:**
`Committed` rows excluded from totals but stored and toggleable · blank-date
rows flagged and excluded · nil amounts (`" -   "`) treated as 0 · junk
`Budget Head` values kept verbatim and flagged · the 5 activity-less sheets
rejected with an explanatory message.
