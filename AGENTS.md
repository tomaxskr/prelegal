# Prelegal Project

## Overview

This is a SaaS product to allow users to draft legal agreements based on templates in the templates directory.
The user can carry out AI chat to fill in agreement fields.
AI chat is implemented for catalog-driven document drafting via `/api/chat/document-session`, including supported-template selection, field collection, draft preview, and PDF download.
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
- **SQLite** initialised on startup via `init_db()` — DB is recreated fresh on each backend start (ephemeral by design for this prototype).
- CORS middleware configured for `localhost:3000` and `localhost:8000`.
- Static file mount serves the Next.js export from `/app/static` (fallback for all non-API routes).
- `/api/health` — health check endpoint.
- Authentication/session endpoints:
	- `/api/auth/signup`
	- `/api/auth/signin`
	- `/api/auth/me`
	- `/api/auth/signout`
- Saved document history endpoints (scoped to authenticated user):
	- `/api/documents` (POST save, GET list)
	- `/api/documents/{document_id}` (GET detail)
- `/api/chat/completions` — generic LiteLLM proxy to OpenRouter.
- `/api/chat/nda-session` — legacy structured Mutual NDA endpoint (still available).
- `/api/chat/document-session` — primary structured multi-document endpoint:
	- Normalizes document selection from user intent and aliases.
	- Collects fields, computes missing fields, and determines draft readiness.
	- Renders draft output from `templates/` with cleaned markdown sections and a formatted collected-data block.
	- Supports unsupported-document handling with closest-match suggestion.
	- Uses free OpenRouter models with automatic fallback to additional free models.
	- If all model calls fail/rate-limit, falls back to deterministic `local-fallback` question flow.
	- Includes guardrails against false alias substring matches (e.g. words containing `sla`).

### Frontend (`frontend/`)
- Next.js 16 with Tailwind CSS, TypeScript, static export (`output: "export"`).
- **`AuthContext`** — API-backed auth with token persistence in `localStorage`, session restore via `/api/auth/me`, and sign-out via `/api/auth/signout`.
- **Login page** (`/login`) — professional sign in/sign up form flow backed by `/api/auth/signin` and `/api/auth/signup`.
- **`AuthProvider`** wraps the whole app in `layout.tsx`.
- Home page uses a freeform **AI chat** panel for catalog-based document intake.
- Chat supports Enter-to-send, Shift+Enter for newline, and auto-scroll to newest message.
- Chat composer is auto-focused so users can continuously type answers without re-clicking the field.
- Chat replies update document field state in real time and drive the draft preview + PDF export.
- Authenticated users can save generated drafts and reload prior drafts from a history panel.
- Draft preview renders markdown + table-formatted collected inputs.
- PDF export handles collected-input table content and strips raw HTML artifacts.
- Legal disclaimer is shown on auth and drafting screens, clarifying that outputs are drafts subject to legal review.
- Existing **NDAForm** + **NDAPreview** components remain in the codebase as legacy components; current flow uses chat-driven preview.
- Vitest unit tests in place for `NDAForm`, `NDAPreview`, and `dateUtils`.
- Additional backend integration tests cover auth and per-user document history.

### Not yet implemented
- JWT-based auth (current implementation uses server-side session tokens stored in SQLite).
- Full per-document bespoke required-field schemas for every catalog template (some documents still use generic fallback fields).
- Persistence of users/sessions/history across backend restarts (current DB is intentionally reset each startup).
