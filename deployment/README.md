# HMA IEMS Deployment Guide

Complete step-by-step instructions for deploying HMA IEMS to AWS EC2 with GitHub Actions CI/CD and Nginx reverse proxy.

## Deployment Architecture

```
GitHub Actions (CI/CD)
    ↓
Build Docker Images (Frontend + Backend)
    ↓
Push to Docker Registry (ECR or DockerHub)
    ↓
AWS EC2 Instance
    ├── Docker Compose (orchestrates containers)
    ├── Nginx (reverse proxy, SSL/TLS)
    └── Supabase (external, RDS optional for backup)
```

## Files in this Directory

- **[1-GITHUB-ACTIONS-SETUP.md](./1-GITHUB-ACTIONS-SETUP.md)** — Configure GitHub Actions to build and push Docker images
- **[2-AWS-EC2-SETUP.md](./2-AWS-EC2-SETUP.md)** — Launch and configure EC2 instance, install Docker & Nginx
- **[3-NGINX-CONFIG.md](./3-NGINX-CONFIG.md)** — Nginx reverse proxy setup, SSL/TLS with Let's Encrypt
- **[4-DEPLOYMENT-PROCESS.md](./4-DEPLOYMENT-PROCESS.md)** — Generic step-by-step deployment commands, health checks, rollback
- **[5-TROUBLESHOOTING.md](./5-TROUBLESHOOTING.md)** — Common issues and solutions
- **[6-EC2-SSH-DEPLOY.md](./6-EC2-SSH-DEPLOY.md)** — **Start here for the actual deploy.** The real, verified procedure for this project's specific setup (Supabase-backed backend DB, real Docker Hub image names, no domain yet)

## Quick Start (TL;DR)

1. Set up GitHub Actions secrets (AWS credentials, Docker registry)
2. Push code to `master2` → GitHub Actions builds images
3. SSH into EC2, pull latest images, run `docker compose up -d`
4. Nginx auto-proxies traffic to backend + frontend containers
5. Done

## Prerequisites

- GitHub repository with Actions enabled
- AWS account with EC2 access and IAM user with permissions
- Domain name (for SSL/TLS)
- ~30 minutes to complete full setup

---

**Start with [1-GITHUB-ACTIONS-SETUP.md](./1-GITHUB-ACTIONS-SETUP.md)**
