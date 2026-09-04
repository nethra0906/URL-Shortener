# 🔗 URL Shortener

A small full-stack URL shortener: a **Flask + SQLite** API that generates
short codes and redirects to the original link, and a **React** frontend
for entering a URL and getting the shortened result back.

```
url-shortener/
├── backend/     Flask API (app.py, tests, requirements)
└── frontend/    React app (Create React App)
```

## Features

- Shorten a URL into a random 6-character code (`POST /shorten`)
- Redirect `GET /<code>` to the original URL
- Input validation — only `http(s)://` URLs with a host are accepted,
  rejecting things like `javascript:` payloads
- Cryptographically random short codes (`secrets`, not `random`) with
  automatic retry on collision
- Copy-to-clipboard, loading state, and inline error messages in the UI

## Prerequisites

- Python 3.9+
- Node.js 18+ and npm

## Backend setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements-dev.txt
python app.py
```

The API listens on `http://localhost:5000` and creates `backend/urls.db`
(a local SQLite file, already git-ignored) on first run.

Configuration is via environment variables (see
[`backend/.env.example`](backend/.env.example)):

| Variable          | Default              | Purpose                                   |
|-------------------|----------------------|--------------------------------------------|
| `DATABASE_PATH`   | `backend/urls.db`    | SQLite database file location             |
| `ALLOWED_ORIGINS` | `*`                  | Comma-separated CORS allow-list           |
| `FLASK_DEBUG`     | `false`              | Enables Flask's debugger/auto-reload      |
| `PORT`            | `5000`               | Port the dev server binds to              |

Run the backend tests:

```bash
cd backend
pytest
```

## Frontend setup

```bash
cd frontend
npm install
npm start
```

The app opens at `http://localhost:3000` and talks to the backend at the
URL in `REACT_APP_API_URL` (see [`frontend/.env.example`](frontend/.env.example)),
defaulting to `http://localhost:5000`. Copy that file to `.env` if you
need to point at a different backend.

Run the frontend tests:

```bash
cd frontend
npm test
```

Build a production bundle:

```bash
cd frontend
npm run build
```

## API reference

### `POST /shorten`

```json
// Request
{ "url": "https://example.com/some/long/path" }

// 201 Created
{
  "short_url": "http://localhost:5000/aB3xY9",
  "short_code": "aB3xY9",
  "original_url": "https://example.com/some/long/path"
}

// 400 Bad Request
{ "error": "URL must start with http:// or https://" }
```

### `GET /<short_code>`

Redirects (302) to the original URL, or returns `404` with
`{ "error": "Short URL not found" }` if the code doesn't exist.

### `GET /health`

Returns `{ "status": "ok" }`. Useful for uptime checks / load balancers.

## Known limitations & next steps

This project intentionally stays small. Things worth adding before
treating it as a production service:

- **Persistence**: SQLite is fine for a demo but doesn't scale to
  multiple server instances; swap in Postgres/MySQL for real deployments.
- **Rate limiting**: `/shorten` has no throttling, so it can be spammed.
- **Auth & ownership**: anyone can shorten any URL; there's no concept
  of accounts, per-user link lists, or link expiry/deletion.
- **Analytics**: click counts / referrer tracking aren't implemented.
- **Production server**: `app.run()` is Flask's dev server; deploy behind
  a WSGI server (gunicorn/waitress) and a reverse proxy (nginx) instead.
- **Custom short codes**: users can't currently request a specific alias.
