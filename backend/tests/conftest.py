import os
import uuid
import base64
import io
import pytest
import requests
from datetime import datetime, timezone, timedelta
from pymongo import MongoClient

BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/') if 'REACT_APP_BACKEND_URL' in os.environ else None

# Fallback: read from frontend .env
if not BASE_URL:
    with open('/app/frontend/.env') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                BASE_URL = line.split('=', 1)[1].strip().rstrip('/')
                break

MONGO_URL = 'mongodb://localhost:27017'
DB_NAME = 'test_database'
# Read backend .env directly to guarantee correctness
with open('/app/backend/.env') as f:
    for line in f:
        line = line.strip()
        if line.startswith('MONGO_URL='):
            MONGO_URL = line.split('=', 1)[1].strip().strip('"')
        elif line.startswith('DB_NAME='):
            DB_NAME = line.split('=', 1)[1].strip().strip('"')


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture(scope="session")
def mongo_db():
    client = MongoClient(MONGO_URL)
    db = client[DB_NAME]
    yield db
    client.close()


@pytest.fixture(scope="session")
def test_user_and_token(mongo_db):
    """Create test user + session directly in MongoDB per auth_testing.md"""
    user_id = f"test-user-{uuid.uuid4().hex[:8]}"
    session_token = f"test-token-{uuid.uuid4().hex}"
    email = f"test.{uuid.uuid4().hex[:6]}@example.com"

    now = datetime.now(timezone.utc)
    mongo_db.users.insert_one({
        "user_id": user_id,
        "email": email,
        "name": "Test User",
        "picture": "",
        "created_at": now.isoformat(),
        "nav_free_used": 0,
    })
    mongo_db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": (now + timedelta(days=7)).isoformat(),
        "created_at": now.isoformat(),
    })

    yield {
        "user_id": user_id,
        "email": email,
        "session_token": session_token,
    }

    # Cleanup
    mongo_db.users.delete_many({"user_id": user_id})
    mongo_db.user_sessions.delete_many({"user_id": user_id})
    mongo_db.chats.delete_many({"user_id": user_id})
    mongo_db.messages.delete_many({"user_id": user_id})
    mongo_db.schedules.delete_many({"user_id": user_id})
    mongo_db.settings.delete_many({"user_id": user_id})
    mongo_db.reports.delete_many({"user_id": user_id})
    mongo_db.nav_daily.delete_many({"user_id": user_id})
    mongo_db.nav_events.delete_many({"user_id": user_id})


@pytest.fixture(scope="session")
def auth_headers(test_user_and_token):
    return {
        "Authorization": f"Bearer {test_user_and_token['session_token']}",
        "Content-Type": "application/json",
    }


@pytest.fixture(scope="session")
def real_image_base64():
    """Create a real PNG with visible content (colored shapes + text) for vision testing."""
    from PIL import Image, ImageDraw, ImageFont
    img = Image.new('RGB', (400, 300), color=(30, 60, 120))
    d = ImageDraw.Draw(img)
    # Red circle
    d.ellipse([50, 50, 200, 200], fill=(220, 40, 40), outline=(255, 255, 255), width=3)
    # Yellow rectangle
    d.rectangle([220, 60, 370, 200], fill=(240, 220, 40), outline=(255, 255, 255), width=3)
    # Text
    try:
        d.text((70, 220), "HELLO WORLD", fill=(255, 255, 255))
    except Exception:
        pass
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return base64.b64encode(buf.getvalue()).decode('ascii')
