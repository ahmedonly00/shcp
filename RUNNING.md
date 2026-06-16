# Running SHCP Locally

## Prerequisites (one-time setup)

### 1. Install Docker Desktop
Download from https://www.docker.com/products/docker-desktop and make sure it is running (whale icon in the taskbar).

### 2. Create your `.env` file
```powershell
cd D:\Desktop\SHCP
copy .env.example .env
```
Open `.env` and fill in real values:

| Variable | Description |
|---|---|
| `DB_PASSWORD` | Any strong password (e.g. `Shcp@2024!`) |
| `JWT_SECRET` | At least 64 random characters |
| `REDIS_PASSWORD` | Any password |
| `RABBITMQ_PASS` | Any password |
| `MAIL_USERNAME` | Your Gmail address |
| `MAIL_PASSWORD` | Your Gmail App Password |
| `COTURN_SECRET` | Any random string (used for video calls) |

### 3. Place the Firebase credentials file
Put your `firebase-adminsdk.json` file at:
```
D:\Desktop\SHCP\secrets\fcm-credentials.json
```
If you don't have it yet, create an empty placeholder:
```powershell
echo {} > secrets\fcm-credentials.json
```

---

## Starting the System

### First time (builds all Docker images — takes 5–10 minutes)
```powershell
cd D:\Desktop\SHCP
docker compose up --build -d
```

### After the first time (images already built — takes ~30 seconds)
```powershell
docker compose up -d
```

---

## Checking Status

Watch all services come up:
```powershell
docker compose ps
```

Wait until all 9 services show `(healthy)`. The API takes the longest (~60 seconds after the DB is ready).

If something looks wrong, tail the logs:
```powershell
# All services:
docker compose logs -f

# One service at a time:
docker compose logs -f api
docker compose logs -f ai-service
docker compose logs -f frontend
```

---

## Accessing the App

Once all services are healthy:

| Service | URL |
|---|---|
| Frontend (React app) | http://localhost |
| Backend API | http://localhost:8082 |
| API health check | http://localhost:8082/actuator/health |
| Signaling server | http://localhost:3001/health |

### Login credentials (from `SEEDED_ACCOUNTS.md`)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@shcp.rw` | `Admin@1234` |
| Provider | `ahmed.provider@yopmail.com` | `Ahmed@123` |
| Patient | `marie.uwimana@yopmail.com` | `Ahmed@123` |
| Pharmacist | `marie.mukamana@yopmail.com` | `Ahmed@123` |

All other seeded accounts use `Ahmed@123`.

---

## Stopping the System

```powershell
# Stop but keep all data:
docker compose down

# Stop and wipe all data (database, Redis, RabbitMQ):
docker compose down -v
```

---

## Quick Reference

```powershell
# Start
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f api

# Stop
docker compose down

# Rebuild one service after a code change
docker compose up --build -d api
```

---

## Services Overview

| Container | Role | Port |
|---|---|---|
| `shcp-frontend` | React/Vite app served by nginx | 80 |
| `shcp-api` | Spring Boot core API | 8082 |
| `shcp-ai` | Python Flask AI/symptom service | internal |
| `shcp-signaling` | Node.js WebRTC signaling | 3001 |
| `shcp-db` | PostgreSQL 15 | internal |
| `shcp-redis` | Redis 7 (tokens, cache, rate limiting) | internal |
| `shcp-rabbitmq` | RabbitMQ 3.13 message broker | internal |
| `shcp-notifications` | Spring Boot notification consumer | internal |
| `shcp-coturn` | TURN relay server for video calls | host network |
