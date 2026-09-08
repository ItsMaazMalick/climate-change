# Docker Deployment Guide: Climate Intelligence Platform

This guide outlines how to build, run, test, and deploy the **Climate Intelligence Platform** (supporting Pakistan and Uzbekistan) using Docker and Docker Compose.

---

## 1. Quick Start with Docker Compose

To launch the application locally in a production-ready container:

```bash
# 1. Build and start the container in detached mode
docker compose up -d --build

# 2. Check container logs
docker compose logs -f

# 3. View running container health
docker compose ps
```

The application will be live and accessible at **`http://localhost:3000`**.

To stop the container:
```bash
docker compose down
```

---

## 2. Standalone Docker Commands

### Build the Image
```bash
docker build -t climate-platform:latest .
```

### Run the Container
```bash
docker run -d \
  --name climate-app \
  -p 3000:3000 \
  --restart unless-stopped \
  -e NODE_ENV=production \
  -e PORT=3000 \
  climate-platform:latest
```

### Check Health Status
```bash
docker inspect --format='{{json .State.Health}}' climate-app
```

---

## 3. Pushing to Live Server / Container Registry

### Option A: Docker Hub
```bash
# 1. Log in to Docker Hub
docker login

# 2. Tag your image
docker tag climate-platform:latest <your-dockerhub-username>/climate-platform:latest

# 3. Push the image
docker push <your-dockerhub-username>/climate-platform:latest

# 4. On your live server / VPS:
docker pull <your-dockerhub-username>/climate-platform:latest
docker run -d -p 80:3000 --restart always <your-dockerhub-username>/climate-platform:latest
```

### Option B: AWS ECR (Elastic Container Registry)
```bash
# 1. Authenticate with AWS ECR
aws ecr get-login-password --region <your-region> | docker login --username AWS --password-stdin <aws_account_id>.dkr.ecr.<your-region>.amazonaws.com

# 2. Tag and push
docker tag climate-platform:latest <aws_account_id>.dkr.ecr.<your-region>.amazonaws.com/climate-platform:latest
docker push <aws_account_id>.dkr.ecr.<your-region>.amazonaws.com/climate-platform:latest
```

### Option C: Google Cloud Artifact Registry
```bash
# 1. Authenticate gcloud
gcloud auth configure-docker <region>-docker.pkg.dev

# 2. Tag and push
docker tag climate-platform:latest <region>-docker.pkg.dev/<project-id>/<repo>/climate-platform:latest
docker push <region>-docker.pkg.dev/<project-id>/<repo>/climate-platform:latest
```

---

## 4. Environment Variables Reference

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Node.js production runtime environment. |
| `PORT` | `3000` | Port on which the Next.js server listens. |
| `HOSTNAME` | `0.0.0.0` | Bind host IP address for the container. |
| `CCKP_API_BASE` | `https://cckpapi.worldbank.org/cckp/v1` | World Bank CCKP upstream API base URL. |
| `CCKP_S3_BASE` | `https://wbg-cckp.s3.amazonaws.com` | World Bank CCKP S3 object store base URL. |
| `OPEN_METEO_BASE` | `https://api.open-meteo.com/v1` | Real-time weather forecast API. |
| `CLIMATE_STORE_MODE` | `auto` | Query resolution mode (`auto`, `grid`, or `upstream`). |
| `DATABASE_URL` | *(optional)* | PostgreSQL + PostGIS connection string if running database warehouse. |

---

## 5. Production Optimization & Security Features

* **Multi-Stage Build:** Uses Node 22 on Alpine Linux, reducing the final image size significantly while keeping dependencies strictly cached.
* **Non-Root User:** Runs under an unprivileged `nextjs:nodejs` (UID 1001) user for maximum container security.
* **Built-in Healthcheck:** Periodically queries `/api/health` to verify that the upstream endpoints and grid caches are responsive.
* **Pre-bundled Data:** Copies all required administrative GeoJSON boundaries and raster assets directly into the standalone bundle.
