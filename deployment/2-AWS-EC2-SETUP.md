# Step 2: AWS EC2 Setup

Launch and configure an EC2 instance to run your Docker containers.

## 1. Launch an EC2 Instance

### Instance Configuration

- **AMI**: Ubuntu 22.04 LTS (look for `ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server`)
- **Instance Type**: `t3.medium` (2 CPU, 4 GB RAM) — sufficient for EMS with < 50 concurrent users
- **Root Volume**: 30 GB (default is fine)
- **Key Pair**: Create or use existing `.pem` file (save it securely, needed for SSH)
- **VPC / Subnet**: Default or your existing VPC
- **Public IP**: Enable (or Elastic IP if you need permanent IP)

### Security Group

Create or use a security group with these **inbound rules**:

| Type | Protocol | Port | Source |
|------|----------|------|--------|
| SSH | TCP | 22 | Your IP / `0.0.0.0/0` (restrict to your office IP for safety) |
| HTTP | TCP | 80 | `0.0.0.0/0` (required for Let's Encrypt challenge) |
| HTTPS | TCP | 443 | `0.0.0.0/0` |

Leave **outbound** as default (allow all).

### Launch the Instance

1. Click "Launch" → wait 2–3 minutes for it to boot
2. Once "Running", note its **Public IPv4** address (e.g., `54.123.45.67`)
3. SSH into it:

```bash
ssh -i /path/to/your-key.pem ubuntu@54.123.45.67
```

---

## 2. Install Docker & Docker Compose

Once SSH'd in, run these commands:

```bash
# Update package list
sudo apt update
sudo apt upgrade -y

# Install Docker
sudo apt install -y docker.io

# Add ubuntu user to docker group (so you don't need sudo)
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo apt install -y docker-compose-plugin

# Exit and re-login for group changes to take effect
exit
```

Then SSH back in:

```bash
ssh -i /path/to/your-key.pem ubuntu@54.123.45.67
```

Verify Docker works:

```bash
docker ps
docker compose version
```

---

## 3. Install Nginx

```bash
sudo apt install -y nginx

# Start and enable Nginx (auto-start on boot)
sudo systemctl start nginx
sudo systemctl enable nginx

# Verify it's running
sudo systemctl status nginx
```

You should see a basic Nginx welcome page at `http://54.123.45.67` in your browser.

---

## 4. Install Certbot (for Let's Encrypt SSL)

```bash
sudo apt install -y certbot python3-certbot-nginx

# We'll configure this in Step 3 after Nginx is properly configured
```

---

## 5. Create Deployment Directory

```bash
# Create a directory for the app
mkdir -p /home/ubuntu/hma-iems
cd /home/ubuntu/hma-iems

# Create folders for logs and data (if using persistent volumes)
mkdir -p logs data

# Set ownership
sudo chown -R ubuntu:ubuntu /home/ubuntu/hma-iems
```

---

## 6. Clone Repository (or Copy docker-compose.yml)

You can either:

**Option A: Clone the repo**
```bash
git clone https://github.com/your-org/HMA.git
cd HMA
```

**Option B: Just copy the docker-compose.yml**
```bash
# From your local machine:
scp -i /path/to/key.pem docker-compose.yml ubuntu@54.123.45.67:/home/ubuntu/hma-iems/

# Then SSH and edit it with real image tags
ssh -i /path/to/key.pem ubuntu@54.123.45.67
cd /home/ubuntu/hma-iems
nano docker-compose.yml  # replace "latest" with actual commit SHA or proper version tag
```

---

## 7. Create `.env` File

On the EC2 instance, create `/home/ubuntu/hma-iems/.env`:

```bash
cat > /home/ubuntu/hma-iems/.env <<EOF
# Backend
DATABASE_URL=postgresql://user:password@your-supabase-host/postgres
SECRET_KEY=$(openssl rand -hex 32)
BACKEND_PORT=8000

# Frontend
VITE_API_BASE_URL=https://yourdomain.com/api
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-actual-key-here
VITE_GOOGLE_CLIENT_ID=your-google-client-id

# Environment
ENVIRONMENT=production
DEBUG=false
EOF

chmod 600 /home/ubuntu/hma-iems/.env
```

Replace placeholders with real values:
- `DATABASE_URL` — from Supabase dashboard
- `VITE_SUPABASE_ANON_KEY` — from your `.env` file locally
- `yourdomain.com` — your actual domain name

---

## 8. Verify EC2 Readiness

```bash
# Confirm Docker
docker --version
docker compose version

# Confirm Nginx
sudo nginx -t
systemctl status nginx

# Confirm .env exists
cat /home/ubuntu/hma-iems/.env | grep -v "KEY\|PASSWORD"  # (don't print secrets)
```

---

## Next Step

Go to **[3-NGINX-CONFIG.md](./3-NGINX-CONFIG.md)** to configure Nginx as a reverse proxy.
