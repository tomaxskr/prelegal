"""
Prelegal Backend API
"""
import os
import sqlite3
from contextlib import asynccontextmanager
from typing import Literal
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

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


class NDAPartyData(BaseModel):
    signature: str = ""
    printName: str = ""
    title: str = ""
    company: str = ""
    noticeAddress: str = ""
    date: str = ""


class NDAFormData(BaseModel):
    purpose: str = ""
    effectiveDate: str = ""
    ndaTerm: Literal["1year", "continues"] = "1year"
    termOfConfidentiality: Literal["1year", "perpetuity"] = "1year"
    governingLaw: str = ""
    jurisdiction: str = ""
    modifications: str = ""
    party1: NDAPartyData = Field(default_factory=NDAPartyData)
    party2: NDAPartyData = Field(default_factory=NDAPartyData)


class NDAChatSessionRequest(BaseModel):
    messages: list[dict]
    currentForm: NDAFormData = Field(default_factory=NDAFormData)
    model: str = "openrouter/openai/gpt-oss-120b:free"


class NDAChatStructuredResponse(BaseModel):
    assistantMessage: str
    formData: NDAFormData
    missingFields: list[str] = Field(default_factory=list)
    readyForReview: bool = False


class NDAChatSessionResponse(NDAChatStructuredResponse):
    model: str


def build_nda_system_prompt(current_form: NDAFormData) -> str:
    return f"""
You are Prelegal's legal intake assistant. You only support ONE document right now: Mutual NDA.

Your responsibilities in each reply:
1) Ask the next best concise question to complete the Mutual NDA.
2) Extract any factual values the user already provided and update formData.
3) Keep collected values intact; only change fields when user clearly updates them.
4) If user asks to use another document type, explain that only Mutual NDA is available and continue collecting Mutual NDA details.

Important fields to collect:
- purpose
- effectiveDate (YYYY-MM-DD)
- ndaTerm: one of [\"1year\", \"continues\"]
- termOfConfidentiality: one of [\"1year\", \"perpetuity\"]
- governingLaw
- jurisdiction
- modifications
- party1.signature, party1.printName, party1.title, party1.company, party1.noticeAddress, party1.date (YYYY-MM-DD)
- party2.signature, party2.printName, party2.title, party2.company, party2.noticeAddress, party2.date (YYYY-MM-DD)

Current known form data:
{current_form.model_dump_json(indent=2)}

Return ONLY a valid JSON object that matches this schema exactly:
{{
  \"assistantMessage\": string,
  \"formData\": NDA form object,
  \"missingFields\": string[],
  \"readyForReview\": boolean
}}

Guidance:
- assistantMessage should be conversational and short (1-3 sentences).
- missingFields should contain dot-paths of still incomplete fields.
- readyForReview should be true only when all required fields are sufficiently filled.
""".strip()


async def complete_nda_chat(request: NDAChatSessionRequest) -> tuple[NDAChatStructuredResponse, str]:
    from litellm import acompletion

    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise Exception("OpenRouter API key not configured")

    fallback_models = [
        request.model,
        "openrouter/meta-llama/llama-3.3-70b-instruct:free",
        "openrouter/google/gemma-3-27b-it:free",
    ]
    model_candidates = list(dict.fromkeys(fallback_models))

    chat_messages = [
        {"role": "system", "content": build_nda_system_prompt(request.currentForm)},
    ]
    for message in request.messages:
        role = message.get("role", "user")
        if role not in {"system", "assistant", "user"}:
            role = "user"
        content = str(message.get("content", "")).strip()
        if content:
            chat_messages.append({"role": role, "content": content})

    last_error = None
    for model_name in model_candidates:
        try:
            response = await acompletion(
                model=model_name,
                messages=chat_messages,
                api_key=api_key,
                response_format={"type": "json_object"},
                temperature=0.2,
            )

            content = response.choices[0].message.content
            if isinstance(content, list):
                content = "".join(
                    part.get("text", "") for part in content if isinstance(part, dict)
                )
            parsed = NDAChatStructuredResponse.model_validate_json(content)
            return parsed, model_name
        except Exception as exc:
            last_error = exc

    if last_error:
        raise last_error
    raise Exception("Unable to complete NDA chat")


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


@app.post("/api/chat/nda-session", response_model=NDAChatSessionResponse)
async def nda_chat_session(request: NDAChatSessionRequest):
    try:
        parsed, used_model = await complete_nda_chat(request)
        return NDAChatSessionResponse(
            assistantMessage=parsed.assistantMessage,
            formData=parsed.formData,
            missingFields=parsed.missingFields,
            readyForReview=parsed.readyForReview,
            model=used_model,
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
