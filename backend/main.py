"""
Prelegal Backend API
"""
import json
import os
import re
import sqlite3
import secrets
import hashlib
import hmac
from difflib import get_close_matches
from datetime import datetime, timezone
from pathlib import Path
from contextlib import asynccontextmanager
from typing import Literal
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

DATABASE_PATH = os.environ.get(
    "DATABASE_PATH",
    str(Path(__file__).resolve().parent / "prelegal.db"),
)
STATIC_DIR = os.environ.get("STATIC_DIR", "static")


def resolve_project_root() -> Path:
    current = Path(__file__).resolve().parent
    candidates = [
        current,
        current.parent,
        Path.cwd(),
    ]
    for candidate in candidates:
        if (candidate / "catalog.json").is_file() and (candidate / "templates").is_dir():
            return candidate
    return current


PROJECT_ROOT = resolve_project_root()
CATALOG_PATH = PROJECT_ROOT / "catalog.json"
TEMPLATES_DIR = PROJECT_ROOT / "templates"


def load_supported_documents() -> list[dict]:
    if not CATALOG_PATH.is_file():
        return []
    with CATALOG_PATH.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    documents: list[dict] = []
    for item in payload:
        if isinstance(item, dict) and item.get("name") and item.get("filename"):
            documents.append(
                {
                    "name": str(item["name"]),
                    "description": str(item.get("description", "")),
                    "filename": str(item["filename"]),
                }
            )
    return documents


SUPPORTED_DOCUMENTS = load_supported_documents()
SUPPORTED_DOCUMENT_NAMES = [doc["name"] for doc in SUPPORTED_DOCUMENTS]


DOCUMENT_ALIASES = {
    "Mutual NDA": [
        "mutual nda",
        "nda",
        "non-disclosure agreement",
        "non disclosure agreement",
        "confidentiality agreement",
    ],
    "Cloud Service Agreement (CSA)": [
        "csa",
        "cloud service agreement",
        "cloud saas agreement",
        "saas agreement",
        "cloud agreement",
        "a cloud saas agreement",
    ],
    "Design Partner Agreement": ["design partner agreement", "design partner"],
    "Service Level Agreement (SLA)": ["sla", "service level agreement"],
    "Data Processing Agreement (DPA)": ["dpa", "data processing agreement"],
    "Professional Services Agreement (PSA)": ["psa", "professional services agreement"],
    "Pilot Agreement": ["pilot agreement", "pilot contract"],
    "Partnership Agreement": ["partnership agreement", "partner agreement"],
    "Software License Agreement": [
        "software license agreement",
        "license agreement",
        "software licensing agreement",
    ],
    "Business Associate Agreement (BAA)": [
        "baa",
        "business associate agreement",
        "hipaa business associate agreement",
    ],
}


REQUIRED_FIELDS_BY_DOCUMENT = {
    "Cloud Service Agreement (CSA)": [
        "providerCompanyName",
        "customerCompanyName",
        "effectiveDate",
        "servicesDescription",
        "fees",
        "term",
        "governingLaw",
    ],
    "Mutual NDA": [
        "party1Name",
        "party2Name",
        "purpose",
        "effectiveDate",
        "term",
        "governingLaw",
    ],
    "Business Associate Agreement (BAA)": [
        "coveredEntityName",
        "businessAssociateName",
        "purpose",
        "effectiveDate",
        "governingLaw",
    ],
}


GENERIC_REQUIRED_FIELDS = [
    "party1Name",
    "party2Name",
    "purpose",
    "effectiveDate",
    "term",
    "governingLaw",
]


FIELD_QUESTIONS = {
    "providerCompanyName": "What is the full legal name of the service provider company?",
    "customerCompanyName": "What is the full legal name of the customer company?",
    "party1Name": "What is the legal name of Party 1?",
    "party2Name": "What is the legal name of Party 2?",
    "coveredEntityName": "What is the legal name of the Covered Entity (e.g. hospital or health plan)?",
    "businessAssociateName": "What is the legal name of the Business Associate?",
    "purpose": "What is the main purpose or scope of this agreement?",
    "effectiveDate": "What is the effective date? Please use YYYY-MM-DD.",
    "servicesDescription": "What services are being provided under this agreement?",
    "fees": "What are the fees or pricing terms?",
    "term": "What is the agreement term length?",
    "governingLaw": "Which governing law/state should apply?",
}


FIELD_LABELS = {
    "providerCompanyName": "Provider Company Name",
    "customerCompanyName": "Customer Company Name",
    "party1Name": "Party 1 Legal Name",
    "party2Name": "Party 2 Legal Name",
    "coveredEntityName": "Covered Entity",
    "businessAssociateName": "Business Associate",
    "purpose": "Purpose",
    "effectiveDate": "Effective Date",
    "servicesDescription": "Services Description",
    "fees": "Fees",
    "term": "Term",
    "governingLaw": "Governing Law",
}


def normalize_document_choice(raw_value: str | None) -> str | None:
    if not raw_value:
        return None

    candidate = raw_value.strip()
    if not candidate:
        return None

    by_name = {name.lower(): name for name in SUPPORTED_DOCUMENT_NAMES}
    exact = by_name.get(candidate.lower())
    if exact:
        return exact

    inferred = infer_document_from_text(candidate)
    if inferred:
        return inferred

    return None


def init_db():
    """Create database and tables from scratch on startup."""
    db_dir = os.path.dirname(DATABASE_PATH)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)

    # Keep the DB intentionally ephemeral for local prototype use.
    if os.path.isfile(DATABASE_PATH):
        os.remove(DATABASE_PATH)

    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            password_salt TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("""
        CREATE TABLE sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
    """)
    cursor.execute("""
        CREATE TABLE documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            selected_document TEXT NOT NULL,
            collected_fields_json TEXT NOT NULL,
            draft_markdown TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(user_id) REFERENCES users(id)
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


class SignUpRequest(BaseModel):
    name: str
    email: str
    password: str


class SignInRequest(BaseModel):
    email: str
    password: str


class AuthResponse(BaseModel):
    token: str
    user: dict


class SaveDocumentRequest(BaseModel):
    selectedDocument: str
    collectedFields: dict[str, str] = Field(default_factory=dict)
    draftMarkdown: str


class SavedDocumentSummary(BaseModel):
    id: int
    selectedDocument: str
    createdAt: str


class SavedDocumentDetail(BaseModel):
    id: int
    selectedDocument: str
    collectedFields: dict[str, str] = Field(default_factory=dict)
    draftMarkdown: str
    createdAt: str


@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}


@app.post("/api/auth/signup", response_model=AuthResponse)
async def auth_signup(request: SignUpRequest):
    name = request.name.strip()
    email = normalize_email(request.email)
    password = request.password

    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Name must be at least 2 characters")
    if "@" not in email or len(email) < 5:
        raise HTTPException(status_code=400, detail="Please provide a valid email")
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    salt = secrets.token_hex(16)
    password_hash = hash_password(password, salt)
    token = secrets.token_urlsafe(32)

    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            INSERT INTO users (email, name, password_hash, password_salt)
            VALUES (?, ?, ?, ?)
            """,
            (email, name, password_hash, salt),
        )
        user_id = cursor.lastrowid
        cursor.execute(
            "INSERT INTO sessions (user_id, token) VALUES (?, ?)",
            (user_id, token),
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.rollback()
        raise HTTPException(status_code=409, detail="An account with that email already exists")
    finally:
        conn.close()

    return AuthResponse(
        token=token,
        user={"id": int(user_id), "name": name, "email": email},
    )


@app.post("/api/auth/signin", response_model=AuthResponse)
async def auth_signin(request: SignInRequest):
    email = normalize_email(request.email)
    password = request.password

    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, email, name, password_hash, password_salt FROM users WHERE email = ?",
        (email,),
    )
    row = cursor.fetchone()

    if not row:
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(password, str(row["password_salt"]), str(row["password_hash"])):
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = secrets.token_urlsafe(32)
    cursor.execute("INSERT INTO sessions (user_id, token) VALUES (?, ?)", (int(row["id"]), token))
    conn.commit()
    conn.close()

    return AuthResponse(
        token=token,
        user={
            "id": int(row["id"]),
            "name": str(row["name"]),
            "email": str(row["email"]),
        },
    )


@app.get("/api/auth/me")
async def auth_me(authorization: str | None = Header(default=None)):
    user = require_user_from_auth_header(authorization)
    return {"user": user}


@app.post("/api/auth/signout")
async def auth_signout(authorization: str | None = Header(default=None)):
    token = parse_bearer_token(authorization)
    if not token:
        return {"ok": True}

    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM sessions WHERE token = ?", (token,))
    conn.commit()
    conn.close()
    return {"ok": True}


@app.post("/api/documents", response_model=SavedDocumentDetail)
async def save_document(
    request: SaveDocumentRequest,
    authorization: str | None = Header(default=None),
):
    user = require_user_from_auth_header(authorization)

    selected_document = normalize_document_choice(request.selectedDocument)
    if not selected_document:
        raise HTTPException(status_code=400, detail="selectedDocument is invalid or unsupported")

    draft_markdown = request.draftMarkdown.strip()
    if not draft_markdown:
        raise HTTPException(status_code=400, detail="draftMarkdown cannot be empty")

    serialized_fields = json.dumps(request.collectedFields)

    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    cursor.execute(
        """
        INSERT INTO documents (user_id, selected_document, collected_fields_json, draft_markdown)
        VALUES (?, ?, ?, ?)
        """,
        (user["id"], selected_document, serialized_fields, draft_markdown),
    )
    document_id = int(cursor.lastrowid)
    conn.commit()
    conn.close()

    return SavedDocumentDetail(
        id=document_id,
        selectedDocument=selected_document,
        collectedFields=request.collectedFields,
        draftMarkdown=draft_markdown,
        createdAt=utc_now_iso(),
    )


@app.get("/api/documents", response_model=list[SavedDocumentSummary])
async def list_documents(authorization: str | None = Header(default=None)):
    user = require_user_from_auth_header(authorization)

    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT id, selected_document, created_at
        FROM documents
        WHERE user_id = ?
        ORDER BY id DESC
        """,
        (user["id"],),
    )
    rows = cursor.fetchall()
    conn.close()

    result: list[SavedDocumentSummary] = []
    for row in rows:
        result.append(
            SavedDocumentSummary(
                id=int(row["id"]),
                selectedDocument=str(row["selected_document"]),
                createdAt=str(row["created_at"]),
            )
        )
    return result


@app.get("/api/documents/{document_id}", response_model=SavedDocumentDetail)
async def get_document(document_id: int, authorization: str | None = Header(default=None)):
    user = require_user_from_auth_header(authorization)

    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT id, selected_document, collected_fields_json, draft_markdown, created_at
        FROM documents
        WHERE id = ? AND user_id = ?
        """,
        (document_id, user["id"]),
    )
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Document not found")

    collected_fields: dict[str, str] = {}
    raw_collected = row["collected_fields_json"]
    if raw_collected:
        try:
            loaded = json.loads(str(raw_collected))
            if isinstance(loaded, dict):
                collected_fields = {str(key): str(value) for key, value in loaded.items()}
        except json.JSONDecodeError:
            collected_fields = {}

    return SavedDocumentDetail(
        id=int(row["id"]),
        selectedDocument=str(row["selected_document"]),
        collectedFields=collected_fields,
        draftMarkdown=str(row["draft_markdown"]),
        createdAt=str(row["created_at"]),
    )


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


class DocumentSessionState(BaseModel):
    selectedDocument: str | None = None
    collectedFields: dict[str, str] = Field(default_factory=dict)
    missingFields: list[str] = Field(default_factory=list)
    readyForDraft: bool = False
    draftMarkdown: str = ""


class DocumentChatSessionRequest(BaseModel):
    messages: list[dict]
    state: DocumentSessionState = Field(default_factory=DocumentSessionState)
    model: str = "openrouter/openai/gpt-oss-120b:free"


class DocumentChatStructuredResponse(BaseModel):
    assistantMessage: str
    selectedDocument: str | None = None
    requestedUnsupportedDocument: str | None = None
    collectedFields: dict[str, str] = Field(default_factory=dict)
    missingFields: list[str] = Field(default_factory=list)
    readyForDraft: bool = False


class DocumentChatSessionResponse(BaseModel):
    assistantMessage: str
    selectedDocument: str | None = None
    isDocumentSupported: bool = True
    suggestedClosestDocument: str | None = None
    collectedFields: dict[str, str] = Field(default_factory=dict)
    missingFields: list[str] = Field(default_factory=list)
    readyForDraft: bool = False
    draftMarkdown: str = ""
    availableDocuments: list[str] = Field(default_factory=list)
    model: str


def normalize_email(raw_email: str) -> str:
    return raw_email.strip().lower()


def hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        120_000,
    ).hex()


def verify_password(password: str, salt: str, expected_hash: str) -> bool:
    candidate = hash_password(password, salt)
    return hmac.compare_digest(candidate, expected_hash)


def parse_bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    parts = authorization.strip().split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    token = parts[1].strip()
    return token or None


def get_user_from_token(token: str | None) -> dict | None:
    if not token:
        return None

    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT users.id, users.email, users.name
        FROM sessions
        JOIN users ON users.id = sessions.user_id
        WHERE sessions.token = ?
        """,
        (token,),
    )
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None

    return {
        "id": int(row["id"]),
        "email": str(row["email"]),
        "name": str(row["name"]),
    }


def require_user_from_auth_header(authorization: str | None) -> dict:
    token = parse_bearer_token(authorization)
    user = get_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return user


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def suggest_closest_document(requested_document: str | None) -> str | None:
    if not requested_document:
        return None

    requested = requested_document.strip().lower()
    if not requested:
        return None

    name_lookup = {name.lower(): name for name in SUPPORTED_DOCUMENT_NAMES}
    if requested in name_lookup:
        return name_lookup[requested]

    close = get_close_matches(requested, list(name_lookup.keys()), n=1, cutoff=0.2)
    if close:
        return name_lookup[close[0]]
    return SUPPORTED_DOCUMENT_NAMES[0] if SUPPORTED_DOCUMENT_NAMES else None


def infer_document_from_text(raw_text: str) -> str | None:
    if not raw_text:
        return None

    text = raw_text.lower()

    def contains_phrase(source_text: str, phrase: str) -> bool:
        # Match aliases as full words/phrases to avoid accidental substring hits
        # such as "verslas" triggering the "sla" alias.
        pattern = r"(?<![a-z0-9])" + re.escape(phrase.lower()) + r"(?![a-z0-9])"
        return re.search(pattern, source_text) is not None

    for document_name, aliases in DOCUMENT_ALIASES.items():
        for alias in aliases:
            if contains_phrase(text, alias):
                return document_name

    for document_name in SUPPORTED_DOCUMENT_NAMES:
        if contains_phrase(text, document_name):
            return document_name

    return None


def infer_document_from_messages(messages: list[dict]) -> str | None:
    for message in reversed(messages):
        if str(message.get("role", "")).lower() != "user":
            continue
        content = str(message.get("content", "")).strip()
        inferred = infer_document_from_text(content)
        if inferred:
            return inferred
    return None


def render_document_draft(selected_document: str, collected_fields: dict[str, str]) -> str:
    template_file = next(
        (doc["filename"] for doc in SUPPORTED_DOCUMENTS if doc["name"] == selected_document),
        None,
    )
    if not template_file:
        return ""

    template_path = TEMPLATES_DIR / template_file
    if not template_path.is_file():
        return ""

    template_text = template_path.read_text(encoding="utf-8")
    template_text = clean_template_for_draft(template_text)
    lines = [
        f"# Draft: {selected_document}",
        "",
        "## Party and Deal Information",
    ]

    ordered_keys = order_collected_field_keys(selected_document, collected_fields)
    if ordered_keys:
        lines.extend([
            "",
            '<table style="width: 100%; border-collapse: separate; border-spacing: 0 10px;">',
            "  <tbody>",
        ])
        for key in ordered_keys:
            label = humanize_field_name(key)
            value = str(collected_fields.get(key, "")).strip()
            escaped_label = escape_html_cell(label)
            escaped_value = escape_html_cell(value)
            lines.append(
                "  <tr>"
                f"<td style=\"width: 36%; padding-right: 28px; vertical-align: top; font-weight: 500; color: #4b5563;\">{escaped_label}</td>"
                f"<td style=\"width: 64%; vertical-align: top;\">{escaped_value}</td>"
                "</tr>"
            )
        lines.extend([
            "  </tbody>",
            "</table>",
        ])
    else:
        lines.extend(["", "No details collected yet."])

    lines.extend([
        "",
        template_text,
    ])
    return "\n".join(lines)


def order_collected_field_keys(selected_document: str, collected_fields: dict[str, str]) -> list[str]:
    required_fields = get_required_fields(selected_document)
    required_in_payload = [
        field_name for field_name in required_fields if field_name in collected_fields
    ]
    other_fields = sorted(
        [field_name for field_name in collected_fields if field_name not in required_in_payload]
    )
    return required_in_payload + other_fields


def humanize_field_name(field_name: str) -> str:
    direct_label = FIELD_LABELS.get(field_name)
    if direct_label:
        return direct_label

    expanded = re.sub(r"(?<!^)(?=[A-Z])", " ", field_name)
    expanded = expanded.replace("_", " ").strip()
    return " ".join(word.capitalize() for word in expanded.split())


def escape_html_cell(value: str) -> str:
    sanitized = value.replace("&", "&amp;")
    sanitized = sanitized.replace("<", "&lt;").replace(">", "&gt;")
    sanitized = sanitized.replace("\r\n", "\n").replace("\n", "<br />")
    return sanitized


def clean_template_for_draft(template_text: str) -> str:
    cleaned = template_text
    cleaned = re.sub(r"<[^>]+>", "", cleaned)
    cleaned = cleaned.replace("\u00a0", " ")
    cleaned = cleaned.replace("âs", "'s")
    cleaned = cleaned.replace("â\u20ac\u2018", "'")
    cleaned = cleaned.replace("â\u20ac\u2122", "'")

    normalized_lines: list[str] = []
    for raw_line in cleaned.splitlines():
        line = raw_line.strip()
        if not line:
            normalized_lines.append("")
            continue

        section_match = re.match(r"^(\d+(?:\.\d+)*)\.\s+(.*)$", line)
        if section_match:
            section_id, section_title = section_match.groups()
            depth = section_id.count(".") + 2
            depth = 3 if depth > 3 else depth
            title_only = section_title
            paragraph_rest = ""
            split_on_double_space = section_title.split("  ", 1)
            if len(split_on_double_space) == 2:
                title_only, paragraph_rest = split_on_double_space

            if normalized_lines and normalized_lines[-1] != "":
                normalized_lines.append("")
            normalized_lines.append(f"{'#' * depth} {section_id} {title_only.strip()}")
            if paragraph_rest.strip():
                normalized_lines.append(paragraph_rest.strip())
            continue

        alpha_match = re.match(r"^([a-z])\.\s+(.*)$", line)
        if alpha_match:
            letter, rest = alpha_match.groups()
            normalized_lines.append(f"- ({letter}) {rest}")
            continue

        normalized_lines.append(line)

    return "\n".join(normalized_lines)


def get_required_fields(selected_document: str | None) -> list[str]:
    if not selected_document:
        return []
    return REQUIRED_FIELDS_BY_DOCUMENT.get(selected_document, GENERIC_REQUIRED_FIELDS)


def build_next_question(field_name: str) -> str:
    return FIELD_QUESTIONS.get(field_name, f"Please provide: {field_name}.")


def extract_basic_fields_from_messages(
    selected_document: str | None,
    messages: list[dict],
    prior_missing_fields: list[str] | None = None,
    existing_collected_fields: dict[str, str] | None = None,
) -> dict[str, str]:
    if not selected_document:
        return {}

    last_user_message = ""
    for message in reversed(messages):
        if str(message.get("role", "")).lower() == "user":
            last_user_message = str(message.get("content", ""))
            break

    if not last_user_message:
        return {}

    extracted: dict[str, str] = {}
    existing_collected_fields = existing_collected_fields or {}
    prior_missing_fields = prior_missing_fields or []
    first_party = re.search(r"first\s+party\s*:\s*([^,\n]+)", last_user_message, re.IGNORECASE)
    second_party = re.search(r"second\s+party\s*:\s*([^,\n]+)", last_user_message, re.IGNORECASE)
    provider = re.search(r"provider\s*:\s*([^,\n]+)", last_user_message, re.IGNORECASE)
    customer = re.search(r"customer\s*:\s*([^,\n]+)", last_user_message, re.IGNORECASE)
    iso_date = re.search(r"\b\d{4}-\d{2}-\d{2}\b", last_user_message)

    if selected_document == "Cloud Service Agreement (CSA)":
        if provider:
            extracted["providerCompanyName"] = provider.group(1).strip()
        elif first_party:
            extracted["providerCompanyName"] = first_party.group(1).strip()

        if customer:
            extracted["customerCompanyName"] = customer.group(1).strip()
        elif second_party:
            extracted["customerCompanyName"] = second_party.group(1).strip()
    else:
        if first_party:
            extracted["party1Name"] = first_party.group(1).strip()
        if second_party:
            extracted["party2Name"] = second_party.group(1).strip()

    if iso_date:
        extracted["effectiveDate"] = iso_date.group(0)

    # Free-text fields where the user's answer may contain commas/colons naturally.
    FREE_TEXT_FIELDS = {"purpose", "servicesDescription", "modifications", "notes"}

    # If the user replies with a plain value (e.g. "Tomas Inc"), map it to
    # the currently expected field so the chat can progress deterministically.
    plain_value = last_user_message.strip()
    looks_structured = (
        " first party" in plain_value.lower()
        or " second party" in plain_value.lower()
        or re.search(r"(?:provider|customer|party\s*\d)\s*:", plain_value, re.IGNORECASE) is not None
    )
    if plain_value and prior_missing_fields and not infer_document_from_text(plain_value):
        current_target_field = prior_missing_fields[0]
        if not str(existing_collected_fields.get(current_target_field, "")).strip():
            is_free_text = current_target_field in FREE_TEXT_FIELDS
            already_extracted = bool(extracted)
            if (is_free_text or (not already_extracted and not looks_structured)):
                if current_target_field == "effectiveDate":
                    date_match = re.search(r"\b\d{4}-\d{2}-\d{2}\b", plain_value)
                    if date_match:
                        extracted[current_target_field] = date_match.group(0)
                else:
                    extracted[current_target_field] = plain_value

    return extracted


def build_document_system_prompt(state: DocumentSessionState) -> str:
    supported_docs_block = "\n".join(
        f"- {doc['name']}: {doc['description']}" for doc in SUPPORTED_DOCUMENTS
    )

    return f"""
You are Prelegal's legal document intake assistant.

Supported documents:
{supported_docs_block}

Your responsibilities on every turn:
1) Determine which supported document the user wants.
2) If user asks for an unsupported document, set requestedUnsupportedDocument and propose the closest supported alternative.
3) Guide the user step-by-step with concise follow-up questions.
4) Collect and preserve user-provided field values in collectedFields.
5) Keep missingFields updated with practical business/legal intake fields.

Current state:
{state.model_dump_json(indent=2)}

Return ONLY valid JSON matching this exact schema:
{{
  "assistantMessage": string,
  "selectedDocument": string | null,
  "requestedUnsupportedDocument": string | null,
  "collectedFields": {{ "fieldName": "value" }},
  "missingFields": string[],
  "readyForDraft": boolean
}}

Rules:
- selectedDocument must be one of the supported documents or null.
- Keep assistantMessage short and specific (1-3 sentences).
- Never claim unsupported templates can be generated.
- If document is not yet decided, ask one clarifying question.
""".strip()


async def complete_document_chat(
    request: DocumentChatSessionRequest,
) -> tuple[DocumentChatStructuredResponse, str]:
    from litellm import acompletion

    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise Exception("OpenRouter API key not configured")

    fallback_models = [
        request.model,
        "openrouter/meta-llama/llama-3.3-70b-instruct:free",
        "openrouter/google/gemma-4-31b-it:free",
    ]
    model_candidates = list(dict.fromkeys(fallback_models))

    chat_messages = [
        {"role": "system", "content": build_document_system_prompt(request.state)},
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
            parsed = DocumentChatStructuredResponse.model_validate_json(content)
            return parsed, model_name
        except Exception as exc:
            last_error = exc

    if last_error:
        fallback = build_local_document_fallback(request)
        return fallback, "local-fallback"
    return build_local_document_fallback(request), "local-fallback"


def build_local_document_fallback(request: DocumentChatSessionRequest) -> DocumentChatStructuredResponse:
    selected_document = (
        infer_document_from_messages(request.messages)
        or normalize_document_choice(request.state.selectedDocument)
    )

    collected = dict(request.state.collectedFields)
    collected.update(extract_basic_fields_from_messages(selected_document, request.messages))

    if selected_document:
        required_fields = get_required_fields(selected_document)
        missing = [
            field_name
            for field_name in required_fields
            if not str(collected.get(field_name, "")).strip()
        ]
        if missing:
            assistant_message = (
                f"I can continue in fallback mode for {selected_document}. "
                f"{build_next_question(missing[0])}"
            )
            return DocumentChatStructuredResponse(
                assistantMessage=assistant_message,
                selectedDocument=selected_document,
                requestedUnsupportedDocument=None,
                collectedFields=collected,
                missingFields=missing,
                readyForDraft=False,
            )

        return DocumentChatStructuredResponse(
            assistantMessage=(
                f"I can continue in fallback mode for {selected_document}. "
                "The draft is ready for review."
            ),
            selectedDocument=selected_document,
            requestedUnsupportedDocument=None,
            collectedFields=collected,
            missingFields=[],
            readyForDraft=True,
        )

    return DocumentChatStructuredResponse(
        assistantMessage=(
            "I can continue in fallback mode right now. "
            "Which supported document do you want to draft (for example: CSA, DPA, NDA, SLA, PSA, Pilot Agreement)?"
        ),
        selectedDocument=None,
        requestedUnsupportedDocument=None,
        collectedFields=collected,
        missingFields=["documentType"],
        readyForDraft=False,
    )


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
        "openrouter/google/gemma-4-31b-it:free",
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


@app.post("/api/chat/document-session", response_model=DocumentChatSessionResponse)
async def document_chat_session(request: DocumentChatSessionRequest):
    try:
        parsed, used_model = await complete_document_chat(request)

        selected_document = normalize_document_choice(parsed.selectedDocument)
        inferred_from_user_messages = infer_document_from_messages(request.messages)
        if inferred_from_user_messages:
            # User's explicit/latest wording should win over model guesswork.
            selected_document = inferred_from_user_messages
        if not selected_document:
            selected_document = infer_document_from_text(parsed.assistantMessage)
        if not selected_document:
            selected_document = normalize_document_choice(request.state.selectedDocument)

        normalized_requested_unsupported = normalize_document_choice(
            parsed.requestedUnsupportedDocument
        )
        requested_unsupported = parsed.requestedUnsupportedDocument
        if normalized_requested_unsupported:
            # Model can misclassify aliases like "CSA" as unsupported; treat these as supported.
            requested_unsupported = None
            if not selected_document:
                selected_document = normalized_requested_unsupported

        merged_collected_fields = dict(request.state.collectedFields)
        merged_collected_fields.update(parsed.collectedFields)
        contextual_missing_fields = request.state.missingFields or parsed.missingFields
        merged_collected_fields.update(
            extract_basic_fields_from_messages(
                selected_document,
                request.messages,
                prior_missing_fields=contextual_missing_fields,
                existing_collected_fields=merged_collected_fields,
            )
        )

        resolved_missing_fields = parsed.missingFields or request.state.missingFields
        resolved_ready_for_draft = parsed.readyForDraft or request.state.readyForDraft

        required_fields = get_required_fields(selected_document)
        if required_fields:
            resolved_missing_fields = [
                field_name
                for field_name in required_fields
                if not str(merged_collected_fields.get(field_name, "")).strip()
            ]
            resolved_ready_for_draft = len(resolved_missing_fields) == 0
        else:
            if resolved_ready_for_draft:
                resolved_missing_fields = []
            if resolved_missing_fields:
                resolved_ready_for_draft = False

        is_supported = selected_document in SUPPORTED_DOCUMENT_NAMES if selected_document else True
        closest = None

        if not is_supported:
            closest = suggest_closest_document(selected_document)
            selected_document = closest

        if requested_unsupported:
            closest = suggest_closest_document(requested_unsupported)

        draft_markdown = ""
        if selected_document and selected_document in SUPPORTED_DOCUMENT_NAMES:
            draft_markdown = render_document_draft(selected_document, merged_collected_fields)

        assistant_message = parsed.assistantMessage
        if requested_unsupported and closest:
            assistant_message = (
                f"I cannot generate '{requested_unsupported}' yet. "
                f"The closest supported option is '{closest}'. {assistant_message}"
            )

        if selected_document and selected_document in SUPPORTED_DOCUMENT_NAMES:
            if resolved_missing_fields:
                assistant_message = (
                    f"Great, we can use {selected_document}. "
                    f"{build_next_question(resolved_missing_fields[0])}"
                )
            elif resolved_ready_for_draft:
                assistant_message = (
                    f"Great, the draft for {selected_document} is ready. "
                    "Review it in Draft Preview and download PDF when you are ready."
                )
            elif len(assistant_message.strip()) < 8:
                assistant_message = (
                    f"Great, we can use {selected_document}. "
                    "Who are the parties and what is the main purpose of this agreement?"
                )

        return DocumentChatSessionResponse(
            assistantMessage=assistant_message,
            selectedDocument=selected_document,
            isDocumentSupported=is_supported and requested_unsupported is None,
            suggestedClosestDocument=closest,
            collectedFields=merged_collected_fields,
            missingFields=resolved_missing_fields,
            readyForDraft=resolved_ready_for_draft,
            draftMarkdown=draft_markdown,
            availableDocuments=SUPPORTED_DOCUMENT_NAMES,
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
