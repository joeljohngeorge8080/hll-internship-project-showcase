import api from './api'

// Mints a one-click AWS Console sign-in link via the FastAPI backend (which
// holds the billing-only IAM user's access key) — see
// backend/app/routers/aws_billing.py. HR/Admin only, enforced server-side.
export const getAwsSigninUrl = (destination) =>
  api.get('/aws/billing/signin-url', { params: { destination } }).then((res) => res.data.url)
