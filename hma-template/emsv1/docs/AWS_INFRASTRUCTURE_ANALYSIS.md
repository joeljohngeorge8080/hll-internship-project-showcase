# HMA IEMS — AWS Infrastructure Analysis

Recreated from a prior analysis session (Jul 21, 2026). Grounded in the actual
implementation, not the original specification — several spec'd features
(email, AI reports) are not built yet, so they are excluded from baseline cost.

## What's actually implemented (verified against code)

| Service | Status | Evidence |
|---|---|---|
| **S3** | ✅ Implemented | `backend/app/core/s3.py` — presigned URL uploads/downloads, bucket `hma-iems-documents` |
| **boto3** | ✅ Installed | `backend/requirements.txt` — `boto3==1.35.71` |
| **EC2 / server** | ✅ Implied by deployment | Currently runs on Render, not AWS (see below) |
| **SES / email** | ❌ Not implemented | No SMTP/SES/Sendgrid config or calls found anywhere in backend |
| **Bedrock / AI reports** | ❌ Not implemented | All reports are client-side calculations in the React frontend (mock/local data) |
| **Lambda / scheduled jobs** | ❌ Not implemented | No Celery, APScheduler, or cron/Lambda jobs found |
| **Rate limiting** | ❌ Not implemented | JWT stateless auth, no throttling middleware found |

## Current deployment reality (verified today, corrects prior session)

`render.yaml` at the repo root shows:
```yaml
plan: free   # both the web service and the database
```
The earlier session's cost comparison assumed a **paid** Render ($35/mo) + Netlify
($20/mo) baseline (~$55/mo). That assumption doesn't match what's actually
configured — the backend and Postgres database are both on Render's **free**
tier right now. Netlify's config (`netlify.toml`) also doesn't specify a paid
plan.

**This matters**: the "AWS is $6/month cheaper" conclusion from the prior
session compared AWS against a *paid* Render+Netlify baseline that isn't
actually in use. If you're currently paying $0/month, migrating to AWS at
~$48.86/month would be a **cost increase**, not a savings — unless the free
tier's limitations (spin-down on idle, storage caps, DB row limits) are
already causing problems worth paying to fix.

## AWS baseline cost estimate (if migrating)

Based on realistic usage for ~20 daily active users, office-hours traffic,
presigned-URL uploads, and Excel parsing (50MB max via openpyxl):

| Service | Est. monthly cost | Notes |
|---|---|---|
| EC2 (t3.small) | ~$28.00 | Backend hosting, sized for 20 DAU |
| S3 (20 GB documents) | ~$2.80 | Employee document storage |
| CloudWatch | ~$3.50 | Basic monitoring |
| EBS | ~$3.60 | EC2 attached storage |
| Elastic IP | ~$3.65 | Static IP for backend |
| Data Transfer | ~$1.50 | Estimated outbound |
| Other (misc) | ~$5.31 | Rounding, small services |
| **Total baseline** | **~$48.86/month** | |

### If features not yet built are added later

| Addition | Est. added cost | Trigger |
|---|---|---|
| SES (email) | +$1.20/month | When email sending is actually implemented |
| Bedrock (Claude, AI reports) | +$10.13/month | When AI-generated financial reports are built |

## Recommendation

Don't migrate to AWS on cost grounds alone — the free-tier Render/Netlify
setup is currently $0/month, and AWS would add ~$49/month. Migrate only if:
- Render's free-tier spin-down (cold starts after inactivity) is hurting UX, or
- Storage/DB limits on the free tier are actually being hit, or
- Email or AI-report features get built and need infra beyond what Render's
  free tier reasonably supports.

If none of those apply yet, the free tier is the cheaper and simpler choice
for the current feature set.

---
*Note: pricing figures are estimates carried over from the prior analysis
session's AWS Pricing Calculator inputs, not re-verified in this pass. The
service-implementation status and the Render `plan: free` finding above were
verified directly against the current codebase on 2026-07-22.*
