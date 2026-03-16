# Mathmentor Setup Guide

Step-by-step setup for local development.

## Prerequisites

- **Python 3.8+** — Backend
- **Node.js 18+** and **npm** — Frontend
- **PostgreSQL** — Database
- **Redis** — WebSocket channel layer (required for real-time messaging)

## Backend Setup

### 1. Virtual environment and dependencies

```bash
cd backend
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Environment variables

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:
- `SECRET_KEY` — Generate with `python -c "import secrets; print(secrets.token_urlsafe(50))"`
- `DB_*` — PostgreSQL credentials (see [postgres_setup.md](postgres_setup.md))
- `CORS_ALLOWED_ORIGINS` — e.g. `http://localhost:3000`
- `REDIS_URL` — e.g. `redis://localhost:6379`
- `STRIPE_*` — Stripe keys (use test keys for dev)
- `JAAS_*` — Jitsi JaaS credentials for video

### 3. Database

Create PostgreSQL database and user (see [postgres_setup.md](postgres_setup.md)), then:

```bash
python manage.py migrate
python manage.py createsuperuser   # optional
```

### 4. Run backend

Start Redis first (required for WebSockets):

```bash
redis-server   # In a separate terminal
```

Then:

```bash
python manage.py runserver
# Or for WebSockets (recommended): daphne -b 0.0.0.0 -p 8000 mathmentor.asgi:application
```

## Frontend Setup

### 1. Dependencies

```bash
cd frontend
npm install
```

### 2. Environment

Create `frontend/.env`:

```
REACT_APP_API_URL=http://localhost:8000
REACT_APP_WS_URL=ws://localhost:8000
```

### 3. Run frontend

```bash
npm start
```

Opens at http://localhost:3000.

## Environment Variables Reference

### Backend (.env)

| Variable | Required | Description |
|----------|----------|-------------|
| SECRET_KEY | Yes | Django secret key |
| DEBUG | No | Default `True` |
| DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT | Yes | PostgreSQL |
| CORS_ALLOWED_ORIGINS | Yes | Comma-separated frontend URLs |
| REDIS_URL | Yes | e.g. `redis://localhost:6379` |
| STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY | Yes | Stripe keys |
| STRIPE_WEBHOOK_SECRET | For webhooks | Stripe webhook secret |
| FRONTEND_URL | Yes | Frontend base URL |
| JAAS_APP_ID, JAAS_API_KEY_ID, JAAS_PRIVATE_KEY_PATH | Yes | Jitsi JaaS for video |
| EMAIL_* | No | SMTP for production; console for dev |

### Frontend (.env)

| Variable | Default | Description |
|----------|---------|-------------|
| REACT_APP_API_URL | http://localhost:8000 | Backend API URL |
| REACT_APP_WS_URL | ws://localhost:8000 | WebSocket URL |

## Redis (required for messaging)

The app uses Redis for Django Channels (real-time chat, instant requests). Without Redis, WebSockets will not work.

```bash
# Install (Ubuntu/Debian)
sudo apt-get install redis-server

# Start
redis-server

# Verify
redis-cli ping   # Should return PONG
```

See [MESSAGING.md](MESSAGING.md) for messaging architecture details.

## Troubleshooting

- **WebSocket not connecting**: Ensure Daphne (not just runserver) is used, and Redis is running.
- **CORS errors**: Add your frontend URL to `CORS_ALLOWED_ORIGINS` in backend `.env`.
- **Database connection**: Verify PostgreSQL is running and credentials in `.env` match.
