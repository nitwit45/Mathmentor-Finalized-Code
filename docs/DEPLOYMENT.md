# Mathmentor Production Deployment

Notes for deploying to production.

## Server Requirements

- Python 3.8+, Node.js 18+ (for build)
- PostgreSQL
- Redis
- Reverse proxy (Nginx or similar)

## Backend (Django)

### Run with Daphne (ASGI)

Use Daphne instead of `runserver` for WebSocket support:

```bash
daphne -b 0.0.0.0 -p 8000 mathmentor.asgi:application
```

Or via process manager (systemd, supervisord). For multiple workers, ensure Redis is used for channel layer (already configured).

### Production Checklist

- Set `DEBUG=False`
- Set `SECRET_KEY` to a cryptographically secure value
- Configure `ALLOWED_HOSTS` with your domain
- Set `SESSION_COOKIE_SECURE=True` and `CSRF_COOKIE_SECURE=True` for HTTPS
- Set `CORS_ALLOWED_ORIGINS` to production frontend URL(s)
- Use production PostgreSQL and Redis instances
- Configure SMTP for email
- Set up Stripe webhook endpoint

## Frontend

Build static assets:

```bash
cd frontend
npm run build
```

Set `REACT_APP_API_URL` and `REACT_APP_WS_URL` to your production backend/WebSocket URLs before building.

Serve the `build/` folder via Nginx or your CDN.

## HTTPS and Certificates

Private keys (`*.key`, `*.csr`) must never be committed. Generate certs on the server:

- Use Let's Encrypt (certbot) for TLS
- Or place your CA/server certs in a secure path and reference in Nginx

Configure Nginx with SSL and proxy to Django/Daphne and frontend.

## Stripe Webhooks

Configure webhook URL in Stripe dashboard to your backend, e.g. `https://yourdomain.com/api/stripe/webhook/`. Set `STRIPE_WEBHOOK_SECRET` in `.env`.

## Jitsi (JaaS) Video

- Obtain JaaS App ID, API Key ID, and private key from 8x8
- Store private key file securely; set `JAAS_PRIVATE_KEY_PATH` to its path
- Key format is typically `.pem` (PEM) or `.pk` depending on 8x8 export

## Nginx Example

```nginx
# Backend
location / {
    proxy_pass http://127.0.0.1:8000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}

# Frontend static
location / {
    root /path/to/frontend/build;
    try_files $uri $uri/ /index.html;
}
```
