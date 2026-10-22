# Step 5: Troubleshooting

Common issues and solutions when deploying HMA IEMS.

---

## Docker Issues

### Container fails to start

**Symptom**: `docker compose logs backend` shows errors during startup.

**Solutions**:
1. Check `.env` file exists and has all required variables:
   ```bash
   cat /home/ubuntu/hma-iems/.env
   # Should include: DATABASE_URL, SECRET_KEY, VITE_SUPABASE_URL, etc.
   ```

2. Verify the image was built correctly (check GitHub Actions workflow):
   ```bash
   docker image inspect your-username/hma-iems-backend:latest
   ```

3. If using Supabase, verify `DATABASE_URL` is correct:
   ```bash
   # Test connection from the container
   docker compose exec backend psql $DATABASE_URL -c "SELECT 1;"
   ```

4. Check Docker daemon is running:
   ```bash
   sudo systemctl status docker
   sudo systemctl restart docker
   ```

---

### Out of disk space

**Symptom**: `no space left on device` error.

**Solution**:
```bash
# Free up old images and containers
docker system prune -a --volumes

# Check disk usage
df -h

# If still full, check Docker image sizes
docker images --format "{{.Repository}}:{{.Tag}} {{.Size}}"
```

---

### Container keeps restarting

**Symptom**: `docker compose ps` shows `Restarting` or `Exited`.

**Solution**:
```bash
# View full container logs
docker compose logs backend --tail=200

# Look for: database connection errors, missing env vars, missing dependencies

# Manually start the container to see the error
docker compose run --rm backend bash
# (Inside container) python -c "import sqlmodel; print('OK')"
```

---

## Network & Connectivity Issues

### Cannot reach backend from frontend

**Symptom**: Frontend shows errors like "Cannot POST /api/..." or "Failed to fetch from API".

**Solution**:
1. Verify both containers are running:
   ```bash
   docker ps | grep hma
   ```

2. Check backend health from inside frontend container:
   ```bash
   docker compose exec frontend curl http://backend:8000/health
   # (backend is the service name in docker-compose.yml)
   ```

3. Check Nginx logs:
   ```bash
   sudo tail -f /var/log/nginx/hma-iems-error.log
   ```

4. If Nginx shows `upstream connection refused`, backend container likely isn't listening on port 8000:
   ```bash
   docker compose exec backend netstat -tlnp | grep 8000
   ```

---

### DNS not resolving yourdomain.com

**Symptom**: `curl https://yourdomain.com` times out or fails.

**Solution**:
1. Verify domain DNS is pointing to your EC2 instance IP:
   ```bash
   nslookup yourdomain.com
   # Should show your EC2 public IP
   ```

2. If DNS is correct but still not resolving, wait 5–15 minutes for propagation.

3. Check if Nginx is actually listening:
   ```bash
   sudo netstat -tlnp | grep nginx
   # Should show ports 80 and 443
   ```

---

## SSL/TLS Issues

### Certificate not found

**Symptom**: Nginx error `SSL_ERROR_BAD_CERT_DOMAIN`.

**Solution**:
1. Verify cert files exist:
   ```bash
   ls -la /etc/letsencrypt/live/yourdomain.com/
   # Should show: fullchain.pem, privkey.pem, etc.
   ```

2. If missing, re-run certbot:
   ```bash
   sudo certbot certonly --webroot -w /var/www/certbot -d yourdomain.com -d www.yourdomain.com
   ```

3. Restart Nginx:
   ```bash
   sudo systemctl restart nginx
   ```

---

### Certificate renewal failed

**Symptom**: Certbot renewal cronjob fails silently.

**Solution**:
1. Test renewal manually:
   ```bash
   sudo certbot renew --force-renewal
   ```

2. Check certbot logs:
   ```bash
   sudo cat /var/log/letsencrypt/letsencrypt.log | tail -50
   ```

3. Ensure HTTP port 80 is open and Nginx is running (Let's Encrypt uses HTTP-01 validation):
   ```bash
   sudo systemctl status nginx
   ```

---

## Database Issues

### Cannot connect to database

**Symptom**: Backend logs show `psycopg2.OperationalError: could not connect to server`.

**Solution**:
1. Verify `DATABASE_URL` in `.env`:
   ```bash
   echo $DATABASE_URL
   # Should look like: postgresql://user:pass@host:5432/dbname
   ```

2. Test connection from the container:
   ```bash
   docker compose exec backend psql "$DATABASE_URL" -c "SELECT 1;"
   ```

3. If Supabase: check IP whitelist in Supabase dashboard:
   - Go to Project Settings → Networking → IP Whitelist
   - Add your EC2 instance public IP or allow all (less secure)

4. Check network connectivity from EC2 to database host:
   ```bash
   sudo apt install postgresql-client
   psql -h your-supabase-host -U postgres -d postgres -c "SELECT 1;"
   ```

---

### Database migrations not running

**Symptom**: Backend starts but database schema is missing.

**Solution**:
1. Run migrations manually:
   ```bash
   docker compose exec backend alembic upgrade head
   # (if using Alembic)
   ```

2. Or, if using SQLModel/FastAPI, you might need to seed the database:
   ```bash
   docker compose exec backend python -c "from app.main import init_db; init_db()"
   ```

3. Check if migrations run automatically on startup (look in backend Dockerfile or `main.py`).

---

## Performance Issues

### Frontend loads slowly

**Symptom**: Page takes 30+ seconds to load.

**Solutions**:
1. Check frontend container CPU/memory:
   ```bash
   docker stats hma-frontend --no-stream
   ```

2. Check if backend is responding quickly:
   ```bash
   time curl https://yourdomain.com/api/health
   # Should respond in < 1 second
   ```

3. Check browser dev tools (Network tab) to see which request is slow.

4. Increase container resource limits in `docker-compose.yml`:
   ```yaml
   services:
     backend:
       deploy:
         resources:
           limits:
             cpus: '2'
             memory: 2G
   ```

---

### Backend API responds slowly

**Symptom**: `/api/*` endpoints take 10+ seconds.

**Solutions**:
1. Check database query performance:
   ```bash
   docker compose logs backend --tail=100 | grep "time\|duration\|slow"
   ```

2. Enable query logging in your backend (if using SQLModel):
   ```python
   import logging
   logging.basicConfig(level=logging.DEBUG)
   ```

3. Check if database connection pool is exhausted:
   ```bash
   docker compose exec backend python -c "from sqlalchemy import inspect; print(inspect(db_engine).get_table_names())"
   ```

4. Restart backend to clear any stuck connections:
   ```bash
   docker compose restart backend
   ```

---

## Rollback Failures

### Old image version not available

**Symptom**: `docker pull your-username/hma-iems-backend:old-commit-sha` fails.

**Solution**:
1. List available image tags:
   ```bash
   # For Docker Hub
   curl -s https://registry.hub.docker.com/v2/repositories/your-username/hma-iems-backend/tags | jq '.results[].name'
   
   # For ECR
   aws ecr describe-images --repository-name hma-iems-backend --region ap-south-1
   ```

2. If the old version isn't available, you have two options:
   - **Rebuild the old version**: Checkout the commit on your local machine and run GitHub Actions again (by re-pushing it)
   - **Fix the new version**: Revert the breaking changes, commit, and deploy again

---

## Emergency Procedures

### Quick stop everything

```bash
# Stop all containers without removing them
docker compose stop

# Or, if you need to forcefully kill them
docker kill $(docker ps -q)
```

### Full reset (WARNING: loses all container data)

```bash
# Remove all containers, networks, and volumes
docker compose down -v

# Delete all images
docker rmi $(docker images -q)

# Start fresh
docker compose up -d
```

### Emergency rollback to a previous known-good state

If everything is broken and you need to restore immediately:

```bash
# 1. Stop current deployment
docker compose down

# 2. Check git history for the last working commit
git log --oneline | head -10

# 3. Checkout that commit
git checkout abc123def456

# 4. Rebuild images locally (or wait for GitHub Actions)
docker compose build

# 5. Start deployment
docker compose up -d
```

---

## Getting Help

If you're stuck:

1. **Check logs first**: `docker compose logs -f`
2. **Search the error message** in the backend/frontend code
3. **Verify environment variables**: `cat .env | grep -v SECRET`
4. **Restart services**: `docker compose restart`
5. **Check EC2 security groups** — is port 80/443 open?
6. **Check DNS** — is yourdomain.com pointing to your EC2 IP?

---

## Additional Resources

- [Docker Documentation](https://docs.docker.com)
- [Docker Compose Documentation](https://docs.docker.com/compose/compose-file/)
- [Nginx Reverse Proxy Guide](https://nginx.org/en/docs/http/ngx_http_proxy_module.html)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Supabase Documentation](https://supabase.com/docs)
