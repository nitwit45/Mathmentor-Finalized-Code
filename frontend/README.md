# Mathmentor Frontend

React SPA for the Mathmentor tutoring platform.

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Development server at http://localhost:3000 |
| `npm run build` | Production build to `build/` |
| `npm test` | Run tests |

## Environment Variables

Create `.env` (or copy from `.env.example` if present):

| Variable | Default | Description |
|----------|---------|-------------|
| REACT_APP_API_URL | http://localhost:8000 | Backend API URL |
| REACT_APP_WS_URL | ws://localhost:8000 | WebSocket URL |

Set these before building for production.
