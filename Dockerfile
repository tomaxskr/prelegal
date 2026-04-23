# Prelegal Dockerfile
# Stage 1: Build Next.js static export
FROM node:20-slim AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: FastAPI backend serving static files + API
FROM python:3.11-slim

RUN pip install uv

WORKDIR /app
COPY backend/pyproject.toml backend/main.py ./
RUN uv pip install --system fastapi uvicorn pydantic litellm

# Copy Next.js static export
COPY --from=frontend-builder /app/frontend/out ./static

# Copy templates and catalog
COPY templates/ ./templates/
COPY catalog.json ./

# Database lives in a writable volume
VOLUME ["/data"]

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
