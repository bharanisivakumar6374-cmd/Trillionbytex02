from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Header, Cookie
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import base64
import requests
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone, timedelta, date

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

MONGO_URL = os.environ['MONGO_URL']
DB_NAME = os.environ['DB_NAME']
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ============ MODELS ============
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = ""
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChatCreate(BaseModel):
    title: Optional[str] = "New Chat"

class MessageIn(BaseModel):
    content: str
    language: Optional[str] = "auto"

class NavigationRequest(BaseModel):
    image_base64: str  # data URL or raw base64
    question: str
    language: Optional[str] = "auto"

class ScheduleIn(BaseModel):
    task_name: str
    message: str
    date: str  # YYYY-MM-DD
    time: str  # HH:MM
    repeat: Optional[str] = "none"  # none|daily|weekly|monthly
    enabled: Optional[bool] = True

class SettingsIn(BaseModel):
    ui_language: Optional[str] = "en"
    ai_language: Optional[str] = "auto"
    voice_enabled: Optional[bool] = True
    voice_name: Optional[str] = ""
    theme: Optional[str] = "dark"
    privacy_analytics: Optional[bool] = True

class ReportIn(BaseModel):
    category: str  # ai|navigation|voice|translation|other
    description: str

# ============ AUTH ============
async def get_current_user(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None),
) -> User:
    token = session_token
    if not token and authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")

    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")

    user_doc = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**user_doc)


@api_router.post("/auth/session")
async def process_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")

    # Call Emergent auth to get user info
    r = requests.get(
        "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
        headers={"X-Session-ID": session_id},
        timeout=15,
    )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session_id")
    data = r.json()

    email = data["email"]
    name = data.get("name", email.split("@")[0])
    picture = data.get("picture", "")
    session_token = data["session_token"]

    # Upsert user
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture}}
        )
        # First login flag — if user existed, they've had first login already
        first_login = False
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "nav_free_used": 0,
        })
        first_login = True

    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 3600,
    )
    return {
        "user_id": user_id,
        "email": email,
        "name": name,
        "picture": picture,
        "first_login": first_login,
        "session_token": session_token,
    }


@api_router.get("/auth/me")
async def me(user: User = Depends(get_current_user)):
    return user.model_dump()


@api_router.post("/auth/logout")
async def logout(response: Response, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    token = session_token
    if not token and authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# ============ CHAT ============
LANG_MAP = {
    "auto": "Auto Detect (respond in the same language the user used; understand mixed language like Tanglish)",
    "en": "English", "ta": "Tamil (தமிழ்)", "tanglish": "Tanglish (mix of Tamil and English, use Latin script naturally)",
    "hi": "Hindi (हिन्दी)", "ja": "Japanese (日本語)", "ko": "Korean (한국어)", "th": "Thai (ไทย)",
    "ml": "Malayalam (മലയാളം)", "te": "Telugu (తెలుగు)", "kn": "Kannada (ಕನ್ನಡ)",
    "bn": "Bengali (বাংলা)", "zh": "Chinese (中文)", "ar": "Arabic (العربية)",
    "es": "Spanish (Español)", "fr": "French (Français)",
}

def build_system_message(language: str) -> str:
    lang_desc = LANG_MAP.get(language, LANG_MAP["auto"])
    return (
        f"You are Zero Two AI, a premium multilingual AI assistant. "
        f"Respond ONLY in this language: {lang_desc}. "
        f"If user asks mixed-language (e.g. 'Computer science na enna?'), understand the mixed input naturally. "
        f"Be concise, clear, and helpful."
    )


@api_router.get("/chats")
async def list_chats(user: User = Depends(get_current_user)):
    chats = await db.chats.find({"user_id": user.user_id}, {"_id": 0}).sort("updated_at", -1).to_list(200)
    return chats


@api_router.post("/chats")
async def create_chat(payload: ChatCreate, user: User = Depends(get_current_user)):
    chat_id = f"chat_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "chat_id": chat_id,
        "user_id": user.user_id,
        "title": payload.title or "New Chat",
        "created_at": now,
        "updated_at": now,
    }
    await db.chats.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.get("/chats/{chat_id}/messages")
async def list_messages(chat_id: str, user: User = Depends(get_current_user)):
    chat = await db.chats.find_one({"chat_id": chat_id, "user_id": user.user_id}, {"_id": 0})
    if not chat:
        raise HTTPException(404, "Chat not found")
    msgs = await db.messages.find({"chat_id": chat_id}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    return msgs


@api_router.post("/chats/{chat_id}/messages")
async def send_message(chat_id: str, payload: MessageIn, user: User = Depends(get_current_user)):
    chat = await db.chats.find_one({"chat_id": chat_id, "user_id": user.user_id}, {"_id": 0})
    if not chat:
        raise HTTPException(404, "Chat not found")

    now = datetime.now(timezone.utc).isoformat()
    user_msg = {
        "message_id": f"msg_{uuid.uuid4().hex[:12]}",
        "chat_id": chat_id,
        "user_id": user.user_id,
        "role": "user",
        "content": payload.content,
        "created_at": now,
    }
    await db.messages.insert_one(user_msg)
    user_msg.pop("_id", None)

    # Build LLM chat with history
    history = await db.messages.find({"chat_id": chat_id}, {"_id": 0}).sort("created_at", 1).to_list(1000)

    llm = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=chat_id,
        system_message=build_system_message(payload.language or "auto"),
    ).with_model("gemini", "gemini-3-flash-preview")

    # Feed prior context by prepending as a synthetic user summary
    context_txt = ""
    if len(history) > 1:
        prior = history[:-1]
        context_txt = "Prior conversation:\n" + "\n".join(
            f"{m['role'].upper()}: {m['content']}" for m in prior[-10:]
        ) + "\n\nCurrent user message:\n"

    try:
        reply = await llm.send_message(UserMessage(text=context_txt + payload.content))
    except Exception as e:
        logger.exception("LLM error")
        raise HTTPException(500, f"AI error: {e}")

    ai_msg = {
        "message_id": f"msg_{uuid.uuid4().hex[:12]}",
        "chat_id": chat_id,
        "user_id": user.user_id,
        "role": "assistant",
        "content": reply,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.messages.insert_one(ai_msg)
    ai_msg.pop("_id", None)

    # Update chat title from first user message if still default
    update = {"updated_at": ai_msg["created_at"]}
    if chat.get("title") in (None, "", "New Chat"):
        update["title"] = payload.content[:48]
    await db.chats.update_one({"chat_id": chat_id}, {"$set": update})

    return {"user_message": user_msg, "assistant_message": ai_msg}


@api_router.delete("/chats/{chat_id}")
async def delete_chat(chat_id: str, user: User = Depends(get_current_user)):
    await db.chats.delete_one({"chat_id": chat_id, "user_id": user.user_id})
    await db.messages.delete_many({"chat_id": chat_id})
    return {"ok": True}


@api_router.post("/chats/{chat_id}/regenerate")
async def regenerate(chat_id: str, user: User = Depends(get_current_user)):
    chat = await db.chats.find_one({"chat_id": chat_id, "user_id": user.user_id}, {"_id": 0})
    if not chat:
        raise HTTPException(404, "Chat not found")
    msgs = await db.messages.find({"chat_id": chat_id}, {"_id": 0}).sort("created_at", 1).to_list(1000)
    # find last user message
    last_user = None
    for m in reversed(msgs):
        if m["role"] == "user":
            last_user = m
            break
    if not last_user:
        raise HTTPException(400, "No user message to regenerate")

    # delete last assistant message if it was after last_user
    if msgs and msgs[-1]["role"] == "assistant":
        await db.messages.delete_one({"message_id": msgs[-1]["message_id"]})

    llm = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=chat_id + "_regen",
        system_message=build_system_message("auto"),
    ).with_model("gemini", "gemini-3-flash-preview")

    try:
        reply = await llm.send_message(UserMessage(text=last_user["content"]))
    except Exception as e:
        raise HTTPException(500, f"AI error: {e}")

    ai_msg = {
        "message_id": f"msg_{uuid.uuid4().hex[:12]}",
        "chat_id": chat_id,
        "user_id": user.user_id,
        "role": "assistant",
        "content": reply,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.messages.insert_one(ai_msg)
    ai_msg.pop("_id", None)
    return ai_msg


# ============ NAVIGATION ============
FREE_LIMIT = 5
DAILY_LIMIT = 10


async def get_nav_usage(user_id: str):
    today_str = date.today().isoformat()
    user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0}) or {}
    free_used = int(user_doc.get("nav_free_used", 0))

    daily = await db.nav_daily.find_one(
        {"user_id": user_id, "day": today_str}, {"_id": 0}
    )
    daily_used = int(daily.get("count", 0)) if daily else 0
    return {
        "free_used": free_used,
        "free_limit": FREE_LIMIT,
        "daily_used": daily_used,
        "daily_limit": DAILY_LIMIT,
        "free_remaining": max(0, FREE_LIMIT - free_used),
    }


@api_router.get("/navigation/usage")
async def nav_usage(user: User = Depends(get_current_user)):
    return await get_nav_usage(user.user_id)


@api_router.post("/navigation/analyze")
async def nav_analyze(payload: NavigationRequest, user: User = Depends(get_current_user)):
    usage = await get_nav_usage(user.user_id)
    if usage["daily_used"] >= DAILY_LIMIT:
        raise HTTPException(429, f"Daily Navigation limit reached ({DAILY_LIMIT}/{DAILY_LIMIT}). Try again tomorrow.")

    # Clean base64 (strip data URL header if present)
    b64 = payload.image_base64
    if b64.startswith("data:"):
        try:
            b64 = b64.split(",", 1)[1]
        except Exception:
            pass

    llm = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"nav_{user.user_id}_{uuid.uuid4().hex[:6]}",
        system_message=build_system_message(payload.language or "auto") +
        " The user has shared a screen capture. Look carefully at what's visible in the image and answer their question. Be concise and specific to what's in the image.",
    ).with_model("gemini", "gemini-3-flash-preview")

    try:
        reply = await llm.send_message(UserMessage(
            text=payload.question,
            file_contents=[ImageContent(image_base64=b64)],
        ))
    except Exception as e:
        logger.exception("Nav LLM error")
        raise HTTPException(500, f"AI error: {e}")

    # Update usage AFTER success
    today_str = date.today().isoformat()
    await db.users.update_one({"user_id": user.user_id}, {"$inc": {"nav_free_used": 1}})
    await db.nav_daily.update_one(
        {"user_id": user.user_id, "day": today_str},
        {"$inc": {"count": 1}, "$setOnInsert": {"user_id": user.user_id, "day": today_str}},
        upsert=True,
    )
    await db.nav_events.insert_one({
        "event_id": f"nev_{uuid.uuid4().hex[:12]}",
        "user_id": user.user_id,
        "question": payload.question,
        "language": payload.language,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    new_usage = await get_nav_usage(user.user_id)
    return {"answer": reply, "usage": new_usage}


# ============ SCHEDULES ============
MAX_SCHEDULES = 5


@api_router.get("/schedules")
async def list_schedules(user: User = Depends(get_current_user)):
    items = await db.schedules.find({"user_id": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return items


@api_router.post("/schedules")
async def create_schedule(payload: ScheduleIn, user: User = Depends(get_current_user)):
    active_count = await db.schedules.count_documents({"user_id": user.user_id, "enabled": True})
    # Only enforce when creating a new enabled schedule
    if payload.enabled and active_count >= MAX_SCHEDULES:
        raise HTTPException(400, f"Maximum {MAX_SCHEDULES} active schedules reached.")
    schedule_id = f"sch_{uuid.uuid4().hex[:12]}"
    doc = {
        "schedule_id": schedule_id,
        "user_id": user.user_id,
        "task_name": payload.task_name,
        "message": payload.message,
        "date": payload.date,
        "time": payload.time,
        "repeat": payload.repeat or "none",
        "enabled": bool(payload.enabled),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.schedules.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api_router.put("/schedules/{schedule_id}")
async def update_schedule(schedule_id: str, payload: ScheduleIn, user: User = Depends(get_current_user)):
    existing = await db.schedules.find_one({"schedule_id": schedule_id, "user_id": user.user_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Schedule not found")
    # if flipping to enabled, enforce max
    if payload.enabled and not existing.get("enabled"):
        active_count = await db.schedules.count_documents({"user_id": user.user_id, "enabled": True})
        if active_count >= MAX_SCHEDULES:
            raise HTTPException(400, f"Maximum {MAX_SCHEDULES} active schedules reached.")
    update = payload.model_dump()
    await db.schedules.update_one({"schedule_id": schedule_id}, {"$set": update})
    doc = await db.schedules.find_one({"schedule_id": schedule_id}, {"_id": 0})
    return doc


@api_router.delete("/schedules/{schedule_id}")
async def delete_schedule(schedule_id: str, user: User = Depends(get_current_user)):
    await db.schedules.delete_one({"schedule_id": schedule_id, "user_id": user.user_id})
    return {"ok": True}


# ============ SETTINGS ============
@api_router.get("/settings")
async def get_settings(user: User = Depends(get_current_user)):
    doc = await db.settings.find_one({"user_id": user.user_id}, {"_id": 0})
    if not doc:
        default = SettingsIn().model_dump()
        default["user_id"] = user.user_id
        await db.settings.insert_one(default)
        default.pop("_id", None)
        return default
    return doc


@api_router.put("/settings")
async def update_settings(payload: SettingsIn, user: User = Depends(get_current_user)):
    update = payload.model_dump()
    await db.settings.update_one(
        {"user_id": user.user_id},
        {"$set": update, "$setOnInsert": {"user_id": user.user_id}},
        upsert=True,
    )
    doc = await db.settings.find_one({"user_id": user.user_id}, {"_id": 0})
    return doc


# ============ REPORTS ============
@api_router.post("/reports")
async def create_report(payload: ReportIn, user: User = Depends(get_current_user)):
    doc = {
        "report_id": f"rep_{uuid.uuid4().hex[:12]}",
        "user_id": user.user_id,
        "email": user.email,
        "category": payload.category,
        "description": payload.description,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.reports.insert_one(doc)
    return {"ok": True, "report_id": doc["report_id"]}


@api_router.get("/")
async def root():
    return {"app": "Zero Two AI", "status": "ok"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
