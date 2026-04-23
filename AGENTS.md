# Prelegal Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory.
The user can carry out AI chat in order to establish what document they want and how to fill in the fields.
The available documents are covered in the catalog.json file in the project root, included here:

@catalog.json

The initial prototype was frontend-only with no AI chat. V1 foundation is now in place (see "Current implementation status" below).

## Development process

When instructed to build a feature:
1. Use your Atlassian tools to read the feature instructions from Jira
2. Develop the feature
3. Thoroughly test the feature with unit tests and integration tests and fix any issues

## AI design

When writing code to make calls to LLMs, use LiteLLM via OpenRouter.

- Default model: `openrouter/openai/gpt-oss-120b:free`
- Only use free-tier models. Do not use paid models under any circumstances.
- Do not specify any inference provider (e.g. Cerebras)
- If the default model is unavailable, fall back to another free OpenRouter model

Always use Structured Outputs with Pydantic models and validate responses using model_validate_json so that responses can be parsed and used to populate fields in the legal document.

There is an OPENROUTER_API_KEY in the .env file in the project root.

## Technical design

The entire project should be packaged into a Docker container.  
The backend should be in backend/ and be a uv project, using FastAPI.  
The frontend should be in frontend/   
The database should use SQLLite and be created from scratch each time the Docker container is brought up, allowing for a users table with sign up and sign in.  
The frontend is statically exported by Next.js (`output: "export"`) and served by FastAPI. All traffic goes to `http://localhost:8000` — no separate frontend port.  
There should be scripts in scripts/ for:  
```bash
# Mac
scripts/start-mac.sh    # Start
scripts/stop-mac.sh     # Stop

# Linux
scripts/start-linux.sh
scripts/stop-linux.sh

# Windows
scripts/start-windows.ps1
scripts/stop-windows.ps1
```
Backend available at http://localhost:8000

## Color Scheme
- Accent Yellow: `#ecad0a`
- Blue Primary: `#209dd7`
- Purple Secondary: `#753991` (submit buttons)
- Dark Navy: `#032147` (headings)
- Gray Text: `#888888`

## Current implementation status

### Infrastructure (complete)
- **Single Docker container** — multi-stage build: Node.js compiles the Next.js static export, then Python/FastAPI serves it. One service, one port (`8000`).
- **docker-compose.yml** — single `app` service with a named volume `prelegal_data` mounted at `/data` for the SQLite database.
- **Scripts** — start/stop scripts in place for Windows, Mac, and Linux (all using `docker-compose`).
- **`.env`** — file exists at project root with `OPENROUTER_API_KEY` placeholder (git-ignored).

### Backend (`backend/`)
- FastAPI with `uvicorn`, uv project (`pyproject.toml`).
- **SQLite** initialised on startup via `init_db()` — creates `/data/prelegal.db` and a `users` table fresh each container start.
- CORS middleware configured for `localhost:3000` and `localhost:8000`.
- Static file mount serves the Next.js export from `/app/static` (fallback for all non-API routes).
- `/api/health` — health check endpoint.
- `/api/chat/completions` — LiteLLM proxy to OpenRouter (stubbed; no auth guard yet).

### Frontend (`frontend/`)
- Next.js 16 with Tailwind CSS, TypeScript, static export (`output: "export"`).
- **`AuthContext`** — simple fake auth: `isLoggedIn` flag stored in `sessionStorage`. No real credentials or API calls.
- **Login page** (`/login`) — single "Continue without signing in" button; calls `login()` then routes to `/`.
- **`AuthProvider`** wraps the whole app in `layout.tsx`.
- Existing **NDAForm** + **NDAPreview** components retained unchanged (Mutual NDA only, no AI chat yet).
- Vitest unit tests in place for `NDAForm`, `NDAPreview`, and `dateUtils`.

### Not yet implemented
- Real user authentication (sign up / sign in with hashed passwords + JWT).
- AI chat flow for document selection and field population.
- Support for documents beyond Mutual NDA.
