# Step 1: GitHub Actions CI/CD Setup

Configure GitHub Actions to automatically build Docker images and push them to a registry on every commit to `master2`.

## Option A: Using Docker Hub (Simpler, Free)

### 1. Create Docker Hub Account & Token

1. Go to [Docker Hub](https://hub.docker.com) and sign up (free)
2. Create a public repository: `your-dockerhub-username/hma-iems-backend`
3. Create another: `your-dockerhub-username/hma-iems-frontend`
4. In Docker Hub settings → Security → New Access Token
   - Name: `github-actions`
   - Permissions: `Read & Write`
   - Copy the token (you won't see it again)

### 2. Add GitHub Secrets

In your GitHub repo settings:

```
Settings → Secrets and variables → Actions → New repository secret
```

Add these secrets:

| Secret Name | Value |
|---|---|
| `DOCKER_HUB_USERNAME` | Your Docker Hub username |
| `DOCKER_HUB_TOKEN` | Token from step 1.4 |
| `DOCKER_HUB_REGISTRY` | `docker.io` (Docker Hub's registry) |

### 3. Create GitHub Actions Workflow

Create `.github/workflows/build-and-push.yml`:

```yaml
name: Build and Push Docker Images

on:
  push:
    branches:
      - master2
    paths:
      - 'backend/**'
      - 'hma-template/emsv1/**'
      - 'docker-compose.yml'
      - '.github/workflows/build-and-push.yml'

env:
  REGISTRY: ${{ secrets.DOCKER_HUB_REGISTRY }}
  USERNAME: ${{ secrets.DOCKER_HUB_USERNAME }}

jobs:
  build-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-buildx-action@v2

      - uses: docker/login-action@v2
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ env.USERNAME }}
          password: ${{ secrets.DOCKER_HUB_TOKEN }}

      - uses: docker/build-push-action@v4
        with:
          context: ./backend
          push: true
          tags: |
            ${{ env.USERNAME }}/hma-iems-backend:latest
            ${{ env.USERNAME }}/hma-iems-backend:${{ github.sha }}

  build-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-buildx-action@v2

      - uses: docker/login-action@v2
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ env.USERNAME }}
          password: ${{ secrets.DOCKER_HUB_TOKEN }}

      - uses: docker/build-push-action@v4
        with:
          context: ./hma-template/emsv1
          push: true
          tags: |
            ${{ env.USERNAME }}/hma-iems-frontend:latest
            ${{ env.USERNAME }}/hma-iems-frontend:${{ github.sha }}
          build-args: |
            VITE_DEV_LOGIN=false
            VITE_API_BASE_URL=https://yourdomain.com/api
            VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
            VITE_SUPABASE_ANON_KEY=${{ secrets.VITE_SUPABASE_ANON_KEY }}
            VITE_GOOGLE_CLIENT_ID=${{ secrets.VITE_GOOGLE_CLIENT_ID }}
```

Add these secrets to GitHub too:

| Secret Name | Value |
|---|---|
| `VITE_SUPABASE_ANON_KEY` | From `.env` in emsv1 |
| `VITE_GOOGLE_CLIENT_ID` | From `.env` in emsv1 |

### 4. Test the Workflow

1. Push a small change to `master2`
2. Go to GitHub repo → Actions tab
3. Watch the workflow run
4. Check Docker Hub — images should appear as `username/hma-iems-backend:latest` and `username/hma-iems-frontend:latest`

---

## Option B: Using AWS ECR (Private, Production-grade)

If you want a private registry on AWS:

### 1. Create ECR Repositories

```bash
aws ecr create-repository --repository-name hma-iems-backend --region ap-south-1
aws ecr create-repository --repository-name hma-iems-frontend --region ap-south-1
```

Get the registry URL (looks like `123456789.dkr.ecr.ap-south-1.amazonaws.com`)

### 2. Create IAM User for GitHub Actions

```bash
# Create user
aws iam create-user --user-name github-actions-hma

# Attach ECR push permissions (use an existing policy or create custom)
aws iam attach-user-policy --user-name github-actions-hma \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser

# Create access key
aws iam create-access-key --user-name github-actions-hma
# (save the Access Key ID and Secret Access Key)
```

### 3. Add GitHub Secrets

| Secret Name | Value |
|---|---|
| `AWS_ACCESS_KEY_ID` | From step 2 |
| `AWS_SECRET_ACCESS_KEY` | From step 2 |
| `AWS_REGION` | `ap-south-1` |
| `ECR_REGISTRY` | `123456789.dkr.ecr.ap-south-1.amazonaws.com` |

### 4. Create Workflow for ECR

```yaml
name: Build and Push to ECR

on:
  push:
    branches:
      - master2

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: docker/setup-buildx-action@v2

      - uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ secrets.AWS_REGION }}

      - run: aws ecr get-login-password --region ${{ secrets.AWS_REGION }} | docker login --username AWS --password-stdin ${{ secrets.ECR_REGISTRY }}

      - uses: docker/build-push-action@v4
        with:
          context: ./backend
          push: true
          tags: |
            ${{ secrets.ECR_REGISTRY }}/hma-iems-backend:latest
            ${{ secrets.ECR_REGISTRY }}/hma-iems-backend:${{ github.sha }}

      - uses: docker/build-push-action@v4
        with:
          context: ./hma-template/emsv1
          push: true
          tags: |
            ${{ secrets.ECR_REGISTRY }}/hma-iems-frontend:latest
            ${{ secrets.ECR_REGISTRY }}/hma-iems-frontend:${{ github.sha }}
```

---

## Next Step

Once images are building and pushing automatically, go to **[2-AWS-EC2-SETUP.md](./2-AWS-EC2-SETUP.md)** to set up the EC2 instance.
