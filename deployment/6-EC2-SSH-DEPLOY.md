# Step 6: EC2 SSH Deployment (Actual Setup)

This is the real, verified deployment procedure for this project — written after
validating the exact same stack locally with `docker compose` (see the root
`docker-compose.yml`). It supersedes the generic placeholders in
`2-AWS-EC2-SETUP.md` / `4-DEPLOYMENT-PROCESS.md` with the actual image names,
architecture, and choices made for this deployment:

- **Backend production database**: Supabase Postgres (not a container on EC2,
  not Render's DB) — matches the design in migration `00000000000051`, which
  already expects the backend-managed `users`/`employees` tables to live in
  the same Supabase project the frontend talks to.
- **No domain yet** — this guide deploys to the EC2 instance's raw public IP.
  Add a domain + SSL later via `3-NGINX-CONFIG.md` once one is ready; nothing
  here blocks that.
- **Images**: `joeljohngeorge8080/hma-backend` and `joeljohngeorge8080/epms`
  on Docker Hub, built by `.github/workflows/deploy-backend.yml` and
  `deploy-frontend.yml` on every push to `master2`.

> **⚠️ Drift notice (as of 2026-09-23)**: production has since moved past this
> "no domain yet" state without the doc being updated at the time. The box now
> runs **host-level nginx** in front of Docker, terminating TLS for
> `https://your-domain.example` via Let's Encrypt, and the frontend container's port
> mapping is `3000:80` (not `80:80` as shown in §6 below). Steps 1–14 below
> are kept as the historical/from-scratch procedure; if the box already has a
> domain configured, check the live `docker-compose.yml` and
> `/etc/nginx/sites-enabled/` on the box before assuming §6/§10 match reality.

Assumes you've already launched the EC2 instance and configured its security
group (per `2-AWS-EC2-SETUP.md` §1) — this picks up from there.

---

## 1. Confirm Security Group

Before SSHing in, confirm these inbound rules exist on the instance's security
group (AWS Console → EC2 → Security Groups):

| Type | Port | Source |
|------|------|--------|
| SSH  | 22   | Your IP |
| HTTP | 80   | `0.0.0.0/0` |

Port 443 isn't needed yet — add it when you set up a domain + SSL.

---

## 2. SSH In

```bash
ssh -i /path/to/your-key.pem ubuntu@<EC2_PUBLIC_IP>
```

Replace `<EC2_PUBLIC_IP>` with the instance's public IPv4 address throughout
this doc.

---

## 3. Install Docker & Docker Compose

```bash
sudo apt update && sudo apt upgrade -y

sudo apt install -y docker.io docker-compose-plugin

sudo usermod -aG docker ubuntu

# Re-login for the group change to take effect
exit
```

SSH back in, then verify:

```bash
ssh -i /path/to/your-key.pem ubuntu@<EC2_PUBLIC_IP>
docker ps
docker compose version
```

---

## 4. Get the Supabase Connection String

From the [Supabase dashboard](https://app.supabase.com) → your project
(`YOUR-PROJECT-REF`) → **Project Settings** → **Database** →
**Connection string** → copy the **Session pooler** URI (works better than
the direct connection from outside Supabase's own network, e.g. an EC2 box).
It looks like:

```
postgresql://postgres.YOUR-PROJECT-REF:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:5432/postgres
```

Replace `[YOUR-PASSWORD]` with your actual database password (from the same
dashboard page, or reset it there if you don't have it).

**Note on schema safety**: the backend calls `create_tables()`
(SQLModel's `metadata.create_all()`) on every startup. This is safe against
an existing schema — it only creates tables that don't already exist, it
never alters or drops existing ones — but as a precaution, watch the first
startup's logs closely (Step 9) before pointing real traffic at it.

---

## 5. Create the Deployment Directory

```bash
mkdir -p /home/ubuntu/hma-iems
cd /home/ubuntu/hma-iems
```

---

## 6. Create `docker-compose.yml`

This pulls the pre-built images from Docker Hub instead of building locally —
no local Postgres container, since the backend now points at Supabase
directly.

```bash
cat > /home/ubuntu/hma-iems/docker-compose.yml <<'EOF'
services:
  backend:
    image: joeljohngeorge8080/hma-backend:latest
    container_name: hma-backend
    env_file:
      - ./backend.env
    expose:
      - "8000"
    restart: unless-stopped

  frontend:
    image: joeljohngeorge8080/epms:latest
    container_name: hma-frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    restart: unless-stopped
EOF
```

**Why no `environment:` override here** (unlike the local dev
`docker-compose.yml`): the frontend's Supabase URL, anon key, and Google
Client ID are **build-time** `VITE_*` args, already baked into the
`joeljohngeorge8080/epms:latest` image by the GitHub Actions workflow. There's
nothing to configure at runtime on the frontend side.

---

## 7. Create the Backend `.env`

**Do this step by hand with `nano`, not by pasting a heredoc with real
secrets into your shell history.** Create the file:

```bash
nano /home/ubuntu/hma-iems/backend.env
```

Paste this template in, then fill in every placeholder marked `<...>`:

```
DATABASE_URL=postgresql://postgres.YOUR-PROJECT-REF:<SUPABASE_DB_PASSWORD>@aws-0-<SUPABASE_REGION>.pooler.supabase.com:5432/postgres
SECRET_KEY=<RUN: openssl rand -hex 32>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480

GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com
ALLOWED_ORIGINS=http://<EC2_PUBLIC_IP>

AWS_ACCESS_KEY_ID=<copy from your local backend/.env>
AWS_SECRET_ACCESS_KEY=<copy from your local backend/.env>
AWS_REGION=ap-south-1

AWS_BILLING_ACCESS_KEY_ID=<copy from your local backend/.env>
AWS_BILLING_SECRET_ACCESS_KEY=<copy from your local backend/.env>

ENVIRONMENT=production
FRONTEND_URL=http://<EC2_PUBLIC_IP>
```

For `SECRET_KEY`, generate a real value first and paste the output in:

```bash
openssl rand -hex 32
```

For the AWS keys — copy them from your local `backend/.env` on your own
machine (`cat backend/.env | grep AWS`) and paste the real values into the
`nano` session on EC2 directly. Don't echo secrets through your shell's
command history or a `cat <<EOF` heredoc — `nano` avoids both.

Save (`Ctrl+O`, Enter, `Ctrl+X`), then lock down the file:

```bash
chmod 600 /home/ubuntu/hma-iems/backend.env
```

These AWS keys are already live in your local dev `.env` — this just carries
the same values to production. Rotate them later if you want separate
prod/dev credentials (worth doing eventually, not blocking this deploy).

---

## 8. Log In to Docker Hub and Pull Images

```bash
docker login -u joeljohngeorge8080
# enter your Docker Hub password or access token when prompted

cd /home/ubuntu/hma-iems
docker compose pull
```

---

## 9. Start the Stack

```bash
docker compose up -d

# Watch startup logs — especially backend, to confirm it connects to
# Supabase cleanly and create_tables() doesn't error
docker compose logs -f backend
```

Look for:
```
Application startup complete.
Uvicorn running on http://0.0.0.0:8000
```

Press `Ctrl+C` to stop following logs (containers keep running).

---

## 10. Verify

```bash
# Containers running
docker ps

# Backend health, through the frontend's internal Nginx proxy
curl http://localhost/health
# Expect: {"status":"ok"}

# Frontend HTML
curl -s http://localhost/ | grep -o '<title>[^<]*</title>'
# Expect: <title>HMA IEMS</title>
```

From your own machine (not SSH'd in):

```bash
curl http://<EC2_PUBLIC_IP>/health
```

If that responds, the security group and Docker port binding are both correct.

---

## 11. Configure Google OAuth for the EC2 IP

Same step we did for `localhost` — go to **Google Cloud Console** →
**APIs & Services** → **Credentials** → the OAuth 2.0 Client ID
(`YOUR_GOOGLE_CLIENT_ID`) → **Edit**, and add to both **Authorized JavaScript
origins** and **Authorized redirect URIs**:

```
http://<EC2_PUBLIC_IP>
```

Save and wait ~30 seconds for it to propagate.

---

## 12. Test End-to-End

Open `http://<EC2_PUBLIC_IP>` in a browser and log in with Google using
`joeljohngeorge2005@gmail.com` (already seeded in the `users` table via
Supabase — same row we added during local testing, since production now
points at the same Supabase project).

Confirm:
- Login succeeds
- Dashboard loads with real data
- No 400/422 errors in the console beyond the known-harmless COOP warnings

---

## 13. Redeploying After a New Push

Every push to `master2` rebuilds and pushes new `:latest` images via GitHub
Actions. To pick them up on EC2:

```bash
cd /home/ubuntu/hma-iems
docker compose pull
docker compose up -d
docker compose logs --tail=50
```

---

## 14. Logs & Troubleshooting

```bash
# All logs
docker compose logs -f

# Just backend
docker compose logs -f backend

# Container status
docker ps -a

# Restart everything
docker compose restart

# Stop everything (keeps containers, just stopped)
docker compose stop
```

For anything not covered here, `5-TROUBLESHOOTING.md` has the broader
reference (some of it assumes host Nginx + domain, which don't apply yet —
skip those sections until Step 15 below).

---

## 15. Later: Domain + SSL

Once you have a domain, follow `3-NGINX-CONFIG.md` to put host Nginx in
front of the frontend container with Let's Encrypt SSL. At that point also:
- Update `ALLOWED_ORIGINS` in `backend.env` to the HTTPS domain
- Add the domain to Google Cloud Console's authorized origins/redirect URIs
  (keep the IP entry too, or remove it once the domain is confirmed working)

---

## 16. Automated Redeploy (CI/CD)

Step 13's manual `docker compose pull && up -d` is now automated by
`.github/workflows/deploy-ec2.yml`. It runs after `deploy-backend.yml` or
`deploy-frontend.yml` finishes pushing a new image to Docker Hub for a push
to `master2`, SSHes into the EC2 box, and does the pull/restart for you, then
curls `http://localhost:3000/health` **from inside that SSH session** —
directly against the frontend container's published port, not through the
host nginx/domain layer. This matters: once a domain + host nginx are in
front (see the drift notice above), `curl http://<EC2_HOST>/health` from
outside no longer reaches the app at all — it hits nginx's `default_server`
catch-all and 404s, even though the deploy succeeded. Checking `localhost`
from inside the box, on the container's own port, is what stays correct
regardless of whatever's in front of it.

**Important**: the container's published port (`3000` today, per the drift
notice above) is hardcoded in the health-check step. If the port mapping in
`docker-compose.yml` on the box ever changes, update it in
`.github/workflows/deploy-ec2.yml` to match, or this check will start failing
even on a successful deploy.

**One-time setup required** (not done by this change — these touch the AWS
console, GitHub repo secrets, and the box's `authorized_keys`, so they need
to be done by hand, once, by whoever owns those credentials):

1. **Generate a dedicated deploy keypair** (don't reuse your personal `.pem`):
   ```bash
   ssh-keygen -t ed25519 -f deploy_key -N "" -C "github-actions-deploy"
   ```
2. **Authorize the public key on the EC2 box**:
   ```bash
   ssh -i /path/to/your-key.pem ubuntu@<EC2_PUBLIC_IP> \
     "echo '<contents of deploy_key.pub>' >> ~/.ssh/authorized_keys"
   ```
3. **Open port 22 to GitHub's runners**: GitHub-hosted runners don't have a
   fixed IP range, so the security group's SSH rule needs `0.0.0.0/0` as the
   source (per `2-AWS-EC2-SETUP.md` §1, this was already the documented
   fallback). This is safe *only* because the box will have password auth
   disabled and only accept the deploy key — confirm
   `PasswordAuthentication no` in `/etc/ssh/sshd_config` before doing this.
4. **Add three repository secrets** (GitHub → repo → Settings → Secrets and
   variables → Actions):
   - `EC2_HOST` — the instance's public IPv4 (or Elastic IP)
   - `EC2_USER` — `ubuntu`
   - `EC2_SSH_KEY` — the full contents of the **private** key
     (`deploy_key`, not `deploy_key.pub`)
5. Delete the local `deploy_key` / `deploy_key.pub` files once the private
   key is safely in GitHub Secrets — don't leave them lying around.

After that, every push to `master2` that touches `backend/**` or
`hma-template/emsv1/**` builds the image, pushes it to Docker Hub, and then
auto-deploys to EC2 with no manual SSH step.
