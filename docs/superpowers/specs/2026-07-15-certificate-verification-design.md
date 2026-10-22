# Digital Credential Verification — Design

**Date:** 2026-07-15
**Status:** Approved by user

## Purpose

HMA issues certificates (Internship Completion, Project Completion,
Workshop, Training, Participation, Achievement, and future types) as
signed PDFs, but there is currently no way for anyone — an employer, the
student, a third party — to verify that a certificate is genuine. This
feature adds a Credential ID + QR code to every certificate, and a public,
no-login verification page that shows VERIFIED / NOT FOUND / REVOKED for
any credential ID.

Lives inside the existing **Internship** page as a new tab, per explicit
instruction. Certificate types beyond "Internship" are supported by the
same feature (the credential ID prefix map is extensible), but the entry
point in the UI is the Internship module.

## Why this can't be a localStorage feature (key constraint)

Every other EMS module (`localInternships.js`, `localGstBills.js`, etc.)
stores data in the browser's `localStorage` — fine for data only ever seen
by staff logged into their own session. The verification page breaks that
assumption: it must be reachable, without login, from a phone that scanned
a QR code printed on a physical certificate — a device with zero access to
the admin's browser storage. This is the one EMS feature that genuinely
needs a shared, server-reachable store.

The repo already contains a real (if under-used) backend for exactly this
purpose: `HMA/backend`, a FastAPI + SQLModel + Postgres + S3 service with
JWT auth (`app/dependencies.py`), used today by `employees` and
`general_expenses`. This feature is built there, following those modules'
existing conventions, rather than introducing a new service.

## Scope

- New backend module: `certificates` (model, schema, service, router) in
  `HMA/backend`, registered in `app/main.py` alongside `auth`, `employees`,
  `general_expenses`.
- New frontend service `src/services/certificates.js` calling the backend
  via the existing `api` axios client (JWT-attached) — the first EMS module
  to talk to the real backend instead of localStorage.
- New "Certificates" tab inside `InternshipPage.jsx` (Admin/HR: create,
  edit metadata, revoke, download; CEO/Heads: view + download; everyone
  else: no access — same as the existing Internship permission entry).
- New public route `/verify/:credentialId`, outside `EmsLayout`/
  `ProtectedRoute`, no auth, no sidebar.
- QR code generation (client-side, `qrcode` npm package) encoding only the
  verification URL.
- **Out of scope:** hard delete of certificates (revoke only — see below);
  auto-stamping the QR into the PDF (admin embeds it manually before
  signing, same as today); a public search/listing endpoint; certificate
  type management UI (new types are added by editing one constant, not
  through the UI); Alembic migrations (this repo has no migrations yet —
  new tables are picked up by the existing `create_tables()` /
  `SQLModel.metadata.create_all()` startup path, same as every other
  model).

## Access control

| Role | Capability |
|---|---|
| Admin, HR | Full: create, edit metadata, revoke, download |
| CEO, Heads | View + download only |
| Project Associate, Project Officer, Employee | No access (tab hidden) |
| Public (no login) | Verify by exact credential ID + download the PDF/photo shown on a successful verification only |

Matches the existing `MODULE.INTERNSHIP` entry in
`src/constants/permissions.js` — no new frontend module constant needed.
On the backend, mutation endpoints reuse the existing `require_hr`
dependency (already Admin-or-HR); view endpoints require any authenticated
user, matching the existing convention in `general_expenses` (view-level
filtering is a frontend concern, enforced via `usePermission` + hiding the
tab).

## Data model (`HMA/backend/app/models/certificate.py`)

```python
class CertificateStatus(str, Enum):
    VALID = 'Valid'
    REVOKED = 'Revoked'

class Certificate(SQLModel, table=True):
    __tablename__ = 'certificates'

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    credential_id: str = Field(unique=True, index=True, max_length=30)   # e.g. INT-2026-000145
    certificate_type: str = Field(max_length=50, index=True)              # validated against prefix map
    student_name: str = Field(max_length=200)
    student_email: Optional[str] = Field(default=None, max_length=255)
    student_photo_key: Optional[str] = Field(default=None, max_length=500)  # S3 key
    certificate_pdf_key: str = Field(max_length=500)                        # S3 key
    issue_date: date
    status: CertificateStatus = Field(default=CertificateStatus.VALID, nullable=False)
    revoked_at: Optional[datetime] = Field(default=None)
    revocation_reason: Optional[str] = Field(default=None)
    created_by: uuid.UUID = Field(foreign_key='users.id', nullable=False)
    created_at: datetime
    updated_at: datetime

class CredentialSequence(SQLModel, table=True):
    __tablename__ = 'credential_sequences'

    prefix: str = Field(primary_key=True, max_length=10)
    year: int = Field(primary_key=True)
    last_seq: int = Field(default=0, nullable=False)
```

The organization name ("HLL Management Academy") is a constant in the
service module, not a DB column — there is one issuer.

## Credential ID generation

```python
CERTIFICATE_TYPE_PREFIXES = {
    'Internship': 'INT',
    'Project Completion': 'PRJ',
    'Workshop': 'WRK',
    'Training': 'TRN',
    'Participation': 'PART',
    'Achievement': 'ACH',
}
```

Adding a future certificate type is a one-line addition to this dict — no
migration, no enum change on the DB column (`certificate_type` is a plain
validated string).

Format: `{PREFIX}-{YEAR}-{SEQ:06d}` (e.g. `INT-2026-000145`). Generation,
inside the same transaction as the certificate insert:

1. `SELECT ... FOR UPDATE` the `(prefix, year)` row in `CredentialSequence`
   (creating it with `last_seq=0` if absent).
2. Increment `last_seq`, format the ID, commit as part of the same
   transaction as the `Certificate` insert.

This makes the row lock the sole source of atomicity — no risk of two
concurrent creations getting the same sequence number.

## File upload & validation

Frontend sends the create request as `multipart/form-data`: metadata
fields (`student_name`, `student_email`, `certificate_type`, `issue_date`)
plus `pdf` (required) and `photo` (optional) files — the same shape as the
existing `POST /general-expenses/upload` endpoint (`Form(...)` +
`File(...)` together).

Backend validates the actual bytes before storing anything:

- **PDF**: first 5 bytes must be `%PDF-`; size ≤ 5 MB.
- **Photo**: magic bytes must match JPEG (`FFD8FF`) or PNG (`89504E47`);
  size ≤ 2 MB.
- Reject anything else with `422` and a specific message (wrong type vs.
  too large).

On success, the backend uploads the validated bytes to S3 itself (new
`upload_bytes(key, content, content_type)` helper in `app/core/s3.py`,
alongside the existing presigned-URL helpers), using the same
`generate_s3_key`-style keying convention as employee documents
(`certificates/{credential_id}/{category}/{uuid}_{filename}`).

This deliberately differs from the employee-documents flow (presigned S3
PUT, content-type trusted from the browser): that flow never inspects file
content server-side, which is acceptable for internal HR document storage
but not for something the public will treat as an authoritative signed
certificate. Content validation requires the bytes to pass through the
backend.

## Backend endpoints (`app/routers/certificates.py`)

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /certificates` | `require_hr` | Create — multipart, validates files, generates credential ID, uploads to S3, writes audit log |
| `GET /certificates` | any authenticated user | List, paginated, filter by status / type / search (name or credential ID) |
| `GET /certificates/{id}` | any authenticated user | Detail (internal id, not credential_id) |
| `PATCH /certificates/{id}` | `require_hr` | Edit metadata only (name, email, type, issue date) — not the files |
| `POST /certificates/{id}/revoke` | `require_hr` | Body: `reason`; sets status + `revoked_at` + `revocation_reason`; audit-logged |
| `GET /certificates/{id}/download-url` | any authenticated user | Fresh presigned S3 URL for the stored PDF (admin-side download) |
| `GET /verify/{credential_id}` | **none (public)** | The verification endpoint — see below |

No `DELETE`. Certificates are compliance/audit records: once issued, they
can only be revoked, never removed, so a previously-valid verification
link never silently 404s without an explanation. (Flagged during design —
confirmed with user: revoke is the intended "delete".)

### Public verification response

`GET /verify/{credential_id}`:

- **Found, valid** → `200`: `credential_id`, `certificate_type`,
  `student_name`, `photo_url` (fresh presigned S3 URL, 1-hour expiry, only
  if a photo was uploaded), `pdf_url` (same), `issue_date`, `status:
  "Valid"`, `organization_name: "HLL Management Academy"`.
- **Found, revoked** → `200`: same shape, `status: "Revoked"`, plus
  `revocation_reason` if one was recorded.
- **Not found** → `404`, generic body (`{"detail": "Certificate not
  found"}`) — identical shape whether the ID is malformed, well-formed but
  never issued, or a near-miss of a real ID. No information leakage about
  which part of the ID was wrong.

### Enumeration & abuse

Sequential, human-readable IDs (`INT-2026-000145`) are guessable by
construction — that trade-off is inherent to the requirement (short,
readable, printable IDs) and can't be engineered away without breaking the
"no ugly UUID" requirement. What *is* addressed:

- No public listing or search endpoint — only exact-credential-id lookup.
- Basic per-IP rate limiting on `/verify/*` (in-memory sliding window
  keyed on `get_client_ip`, already available in `app/dependencies.py`;
  no new infra).
- Credential ID format is validated by regex
  (`^[A-Z]{2,5}-\d{4}-\d{6}$`) before any DB query, so garbage input is
  rejected cheaply and consistently.
- SQLModel/SQLAlchemy parameterizes all queries — no string-built SQL.

## QR code

Generated **client-side only**, using the `qrcode` npm package (new
dependency — small, single-purpose, same category as the already-added
`xlsx`/`xlsx-js-style`). Encodes exactly one thing:

```
https://<app-domain>/#/verify/{credential_id}
```

(`#/` because the app uses `HashRouter`.) Never encodes name, email, or
any certificate detail. Shown as a downloadable PNG immediately after
certificate creation in the admin UI.

The certificate PDF is already signed by the time it's uploaded (per the
described workflow), so the system does not programmatically stamp the QR
into the PDF — that would require a PDF-editing dependency this feature
doesn't otherwise need. The admin downloads the generated QR image and
includes it when preparing the certificate, same manual step as today,
just backed by a real generated code instead of nothing.

## Frontend

- `src/services/certificates.js` — thin wrapper over `api` (list, get,
  create (multipart), update, revoke, downloadUrl). No localStorage.
- `InternshipPage.jsx` gains a `CNav`/`CNavItem` tab strip: **"Interns"**
  (existing table and modal, unchanged) and **"Certificates"** (new):
  table (credential ID, name, type, issue date, status badge), "Issue
  Certificate" modal (metadata form + photo/PDF pickers, client-side
  pre-checks mirroring the backend's magic-byte/size rules for fast
  feedback), row actions (view detail w/ QR + download, revoke w/ reason
  prompt). Gated by the same `usePermission(MODULE.INTERNSHIP, 'edit')`
  already used for the Interns tab.
- `App.jsx` — new route, sibling to `/login`/`/404`/`/500`:
  ```jsx
  <Route path="/verify/:credentialId" element={<VerifyCertificatePage />} />
  ```
  `VerifyCertificatePage` (`src/views/pages/verify/VerifyCertificatePage.jsx`,
  lazy-loaded like `Login`) — standalone layout (no `EmsLayout`, no auth
  check), calls `GET /verify/{credential_id}` unauthenticated, renders one
  of three states:
  - ✅ **VERIFIED** — photo, name, certificate type, issue date, credential
    ID, organization name, "Valid", download button.
  - ❌ **Certificate Not Found** — for any 404.
  - ⚠️ **Certificate Revoked** — same details + reason if provided.

## Error handling

- Invalid/missing files on create → `422` with a specific reason, shown
  inline in the modal (not a generic toast).
- `revocation_reason` is an optional field end-to-end: the admin revoke
  modal has a reason textarea that may be left blank, and the public
  revoked-state display simply omits the reason line when none was
  recorded (matches the spec's "Reason (optional)" wording).
- Verification page network/server error (5xx, unreachable) → a fourth,
  distinct state ("Couldn't check this certificate right now — try
  again"), never conflated with "Not Found".
- Rate-limit hit on `/verify/*` → `429`, verification page shows a
  "Too many checks — try again shortly" message.

## Testing

- Backend: unit tests for the credential ID generator (concurrency /
  race-safety of the sequence increment), file-validation (magic bytes,
  size limits, rejection cases), and the three verify-endpoint outcomes
  (valid / revoked / not-found), plus role checks on mutation endpoints.
- Frontend: exercise the full admin flow (issue → see QR/credential ID →
  revoke) and the public verify page's three states against a running
  backend, using this repo's existing Playwright-based manual verification
  approach (per `2026-07-14-playwright-system-audit-design.md` precedent)
  rather than introducing a new test framework.
