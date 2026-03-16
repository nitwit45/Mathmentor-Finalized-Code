# Messaging System - Redis and WebSockets

## Overview

Real-time chat uses Django Channels with Redis. Redis is **required** for WebSockets.

## Key Components

- **Redis Channel Layer**: Messages broadcast across processes
- **REST Fallback**: When WebSocket is down, REST API sends messages and broadcasts via channel layer
- **Optimistic UI**: Pending → sent → delivered → read status indicators
- **Heartbeat**: Ping/pong every 30s; reconnect after 2 missed pongs

## Setup

```bash
# Install Redis (Ubuntu/Debian)
sudo apt-get install redis-server

# Start
redis-server

# Verify
redis-cli ping   # PONG
```

Set `REDIS_URL=redis://localhost:6379` in backend `.env`.

## WebSocket URLs

- Development: `ws://localhost:8000`
- Production: Set `REACT_APP_WS_URL` in frontend

## Troubleshooting

- **Messages not sending**: Check Redis (`redis-cli ping`), use Daphne not runserver
- **WebSocket not connecting**: Verify Daphne, CORS, `REACT_APP_WS_URL`
