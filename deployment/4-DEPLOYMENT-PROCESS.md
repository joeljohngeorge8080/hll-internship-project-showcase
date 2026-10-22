# Step 4: Deployment Process

Deploy Docker containers and manage the application lifecycle.

## 1. Pull Latest Images

After your GitHub Actions workflow has built and pushed images, SSH into the EC2 instance and pull them:

```bash
ssh -i /path/to/key.pem ubuntu@54.123.45.67
cd /home/ubuntu/hma-iems

# Log in to your registry (Docker Hub)
docker login

# Or for ECR:
# aws ecr get-login-password --region ap-south-1 | docker login --username AWS --password-stdin 123456789.dkr.ecr.ap-south-1.amazonaws.com

# Pull the latest images
docker pull your-username/hma-iems-frontend:latest
docker pull your-username/hma-iems-backend:latest
```

---

## 2. Prepare docker-compose.yml

Ensure `/home/ubuntu/hma-iems/docker-compose.yml` exists. Here's a complete example:

```yaml
version: '3.8'

services:
  backend:
    image: your-username/hma-iems-backend:latest
    container_name: hma-backend
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: ${DATABASE_URL}
      SECRET_KEY: ${SECRET_KEY}
      ENVIRONMENT: ${ENVIRONMENT}
      DEBUG: ${DEBUG}
    env_file:
      - .env
    volumes:
      - ./logs/backend:/app/logs
    restart: unless-stopped
    networks:
      - hma-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  frontend:
    image: your-username/hma-iems-frontend:latest
    container_name: hma-frontend
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
    env_file:
      - .env
    restart: unless-stopped
    depends_on:
      - backend
    networks:
      - hma-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

networks:
  hma-network:
    driver: bridge

volumes:
  backend-logs:
```

---

## 3. First Deployment

```bash
cd /home/ubuntu/hma-iems

# Start containers in the background
docker compose up -d

# Watch startup logs
docker compose logs -f

# Wait ~30 seconds for containers to initialize
```

Expected output:

```
[+] Running 2/2
 ✓ Container hma-backend   Started
 ✓ Container hma-frontend  Started
```

---

## 4. Health Checks

Check container status:

```bash
# Check running containers
docker ps

# Check container health
docker inspect hma-backend --format='{{.State.Health.Status}}'
docker inspect hma-frontend --format='{{.State.Health.Status}}'

# Should show: "healthy"
```

Check application endpoints:

```bash
# Backend API health
curl http://localhost:8000/health

# Frontend (should return HTML)
curl http://localhost:3000

# Through Nginx (HTTPS)
curl https://yourdomain.com/api/health
```

Expected responses:
- Backend: `{"status": "ok"}` or similar
- Frontend: HTML page
- Both should return HTTP 200

---

## 5. Verify Nginx Routing

```bash
# Test frontend through Nginx
curl -I https://yourdomain.com
# Should be 200

# Test backend API through Nginx
curl -I https://yourdomain.com/api/health
# Should be 200
```

---

## 6. Monitor Logs

```bash
# View all container logs
docker compose logs -f

# View only backend logs
docker compose logs -f backend

# View only frontend logs
docker compose logs -f frontend

# View last 100 lines
docker compose logs --tail=100

# View Nginx logs on the host
sudo tail -f /var/log/nginx/hma-iems-error.log
sudo tail -f /var/log/nginx/hma-iems-access.log
```

---

## 7. Restart / Stop Services

```bash
# Restart all containers (keeps them running)
docker compose restart

# Restart just backend
docker compose restart backend

# Stop all containers
docker compose down

# Stop and remove volumes (CAREFUL — loses data)
docker compose down -v
```

---

## 8. Update to a New Version

When you push a new commit to `master2` and GitHub Actions builds a new image:

```bash
cd /home/ubuntu/hma-iems

# Pull latest images
docker pull your-username/hma-iems-backend:latest
docker pull your-username/hma-iems-frontend:latest

# Recreate containers with new images
docker compose up -d

# Verify health
docker inspect hma-backend --format='{{.State.Health.Status}}'
docker inspect hma-frontend --format='{{.State.Health.Status}}'

# Check logs for errors
docker compose logs --tail=50
```

---

## 9. Rollback Procedure

If the new version is broken, quickly revert to a known-good version:

```bash
# Pull a specific tagged version (e.g., from your last stable commit)
docker pull your-username/hma-iems-backend:abc123def456  # commit SHA
docker pull your-username/hma-iems-frontend:abc123def456

# Update docker-compose.yml to use the specific SHA instead of 'latest'
# Edit the service image lines:
# image: your-username/hma-iems-backend:abc123def456

# Recreate containers
docker compose up -d

# Verify
docker compose logs --tail=20
```

Alternatively, keep the `.env` and `.git` history to quickly cherry-pick an old version.

---

## 10. Database Backups

If using Supabase (managed), backups are automatic. If using a self-hosted PostgreSQL:

```bash
# Backup the database
docker compose exec backend pg_dump -U postgres -d hma_iems > backup-$(date +%Y%m%d_%H%M%S).sql

# Restore from backup
docker compose exec -T backend psql -U postgres -d hma_iems < backup-20260917_120000.sql
```

---

## Common Issues During Deployment

| Issue | Fix |
|-------|-----|
| `docker: not found` | Reinstall Docker (see Step 2 of `2-AWS-EC2-SETUP.md`) |
| `502 Bad Gateway` on frontend | Backend container not healthy; check `docker logs backend` |
| `Cannot connect to Docker daemon` | Run `sudo systemctl start docker` |
| `Image pull rate limit` | Docker Hub has rate limits; wait 1 hour or use ECR |
| `Out of disk space` | Run `docker system prune` to clean up old images |
| `Env vars not loading` | Check `.env` file exists and is readable; verify with `cat .env` |

---

## Monitoring in Production

Monitor container resource usage:

```bash
# Real-time resource stats
docker stats

# Or in a separate window
docker stats --no-stream

# Get container uptime
docker inspect hma-backend --format='Started: {{.State.StartedAt}}'
```

---

## Next Step

Go to **[5-TROUBLESHOOTING.md](./5-TROUBLESHOOTING.md)** for common issues and solutions.
