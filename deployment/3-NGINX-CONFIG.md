# Step 3: Nginx Configuration

Configure Nginx as a reverse proxy for your Docker containers and set up SSL/TLS.

## 1. Remove Default Nginx Config

```bash
sudo rm /etc/nginx/sites-enabled/default
sudo rm /etc/nginx/sites-available/default
```

---

## 2. Create Nginx Config for HMA IEMS

Create `/etc/nginx/sites-available/hma-iems`:

```bash
sudo tee /etc/nginx/sites-available/hma-iems > /dev/null <<'EOF'
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Let's Encrypt challenge endpoint
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    # SSL certificates (add these after running certbot)
    # ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    
    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Gzip compression
    gzip on;
    gzip_types text/plain text/css text/javascript application/json application/javascript image/svg+xml;
    gzip_min_length 1000;
    
    # Frontend (React app)
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
        proxy_connect_timeout 60s;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    
    # Backend API
    location /api/ {
        proxy_pass http://localhost:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        
        # Allow larger uploads for file endpoints
        client_max_body_size 100M;
    }
    
    # Deny access to sensitive files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
    
    # Logging
    access_log /var/log/nginx/hma-iems-access.log;
    error_log /var/log/nginx/hma-iems-error.log;
}
EOF
```

**Replace `yourdomain.com` with your actual domain.**

---

## 3. Enable the Config

```bash
# Create symlink to enable the site
sudo ln -s /etc/nginx/sites-available/hma-iems /etc/nginx/sites-enabled/

# Test Nginx syntax
sudo nginx -t

# Reload Nginx (without SSL certs yet, this will fail — that's expected)
sudo systemctl reload nginx
```

---

## 4. Set Up SSL/TLS with Let's Encrypt

Create the certbot webroot directory:

```bash
sudo mkdir -p /var/www/certbot
sudo chown -R www-data:www-data /var/www/certbot
```

Run certbot:

```bash
sudo certbot certonly --webroot \
  -w /var/www/certbot \
  -d yourdomain.com \
  -d www.yourdomain.com \
  -m your-email@example.com \
  --agree-tos \
  --non-interactive
```

If successful, you'll see:

```
Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/yourdomain.com/fullchain.pem
Key is saved at: /etc/letsencrypt/live/yourdomain.com/privkey.pem
```

---

## 5. Uncomment SSL Lines in Nginx Config

Edit `/etc/nginx/sites-available/hma-iems` and uncomment the SSL certificate lines:

```bash
sudo nano /etc/nginx/sites-available/hma-iems
```

Find these lines and uncomment them:

```nginx
ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
```

Then reload Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Test SSL at: `https://yourdomain.com`

---

## 6. Auto-Renew SSL Certs

Let's Encrypt certs expire in 90 days. Set up auto-renewal:

```bash
# Check if renewal service exists
sudo systemctl list-timers | grep certbot

# If not, create it
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# Test renewal (dry-run, won't actually renew)
sudo certbot renew --dry-run
```

---

## 7. Security: Restrict Backend Admin Endpoints

If your backend has admin-only endpoints (e.g., `/admin/`, `/api/admin/`), restrict them:

Add this to the HTTPS `server` block in `/etc/nginx/sites-available/hma-iems`:

```nginx
# Restrict admin endpoints to office IP only
location /api/admin/ {
    allow 203.0.113.0/24;  # Replace with your office IP/CIDR
    deny all;
    
    proxy_pass http://localhost:8000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

---

## 8. Verify Nginx is Working

```bash
# Test connectivity
sudo systemctl status nginx

# Check logs for errors
sudo tail -f /var/log/nginx/hma-iems-error.log
```

Open a browser and visit:
- `http://yourdomain.com` (should redirect to HTTPS)
- `https://yourdomain.com` (should show the frontend, or a Docker-not-ready error)

---

## Common Issues

| Issue | Fix |
|-------|-----|
| `Connection refused` | Docker containers not running yet (see Step 4) |
| `502 Bad Gateway` | Backend not healthy; check `docker logs` |
| `SSL_ERROR_RX_RECORD_TOO_LONG` on HTTP | Make sure HTTP→HTTPS redirect is configured |
| `certificate pending validation` | DNS not propagated; wait 5–10 min or check `certbot logs` |

---

## Next Step

Go to **[4-DEPLOYMENT-PROCESS.md](./4-DEPLOYMENT-PROCESS.md)** to deploy the Docker containers.
