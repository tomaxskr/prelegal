"""
Prelegal Backend API
"""
import os
import sqlite3
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

DATABASE_PATH = os.environ.get("DATABASE_PATH", "/data/prelegal.db")
STATIC_DIR = os.environ.get("STATIC_DIR", "static")


def init_db():
    """Create database and tables from scratch on startup."""
    db_dir = os.path.dirname(DATABASE_PATH)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Prelegal API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}


class ChatRequest(BaseModel):
    messages: list[dict]
    model: str = "openrouter/openai/gpt-oss-120b:free"


class ChatResponse(BaseModel):
    choices: list[dict]
    model: str


@app.post("/api/chat/completions", response_model=ChatResponse)
async def chat_completions(request: ChatRequest):
    try:
        from litellm import acompletion

        api_key = os.environ.get("OPENROUTER_API_KEY")
        if not api_key:
            raise Exception("OpenRouter API key not configured")

        response = await acompletion(
            model=request.model,
            messages=request.messages,
            api_key=api_key,
        )

        return ChatResponse(
            choices=[{"message": {"content": response.choices[0].message.content}}],
            model=request.model,
        )
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=str(e))


# Serve static Next.js export — must be mounted last so API routes take priority
if os.path.isdir(STATIC_DIR):
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
