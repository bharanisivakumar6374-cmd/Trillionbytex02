"""Backend tests for Zero Two AI - all endpoints per review_request."""
import os
import time
import requests
import pytest

BASE_URL = None
with open('/app/frontend/.env') as f:
    for line in f:
        if line.startswith('REACT_APP_BACKEND_URL='):
            BASE_URL = line.split('=', 1)[1].strip().rstrip('/')
            break


# ===================== Health =====================
class TestHealth:
    def test_root(self):
        r = requests.get(f"{BASE_URL}/api/", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data.get("app") == "Zero Two AI"
        assert data.get("status") == "ok"


# ===================== Auth =====================
class TestAuth:
    def test_me_without_token_401(self):
        r = requests.get(f"{BASE_URL}/api/auth/me", timeout=15)
        assert r.status_code == 401

    def test_me_with_bearer_token(self, auth_headers, test_user_and_token):
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["user_id"] == test_user_and_token["user_id"]
        assert data["email"] == test_user_and_token["email"]

    def test_me_with_invalid_token(self):
        r = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": "Bearer invalid-nonexistent-token-xyz"},
            timeout=15,
        )
        assert r.status_code == 401


# ===================== Chat CRUD + LLM =====================
class TestChat:
    chat_id = None

    def test_01_create_chat(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/chats", headers=auth_headers,
                          json={"title": "Test Chat"}, timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "chat_id" in data
        assert data["title"] == "Test Chat"
        TestChat.chat_id = data["chat_id"]

    def test_02_list_chats(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/chats", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        chats = r.json()
        assert any(c["chat_id"] == TestChat.chat_id for c in chats)

    def test_03_send_message_english(self, auth_headers):
        assert TestChat.chat_id
        r = requests.post(
            f"{BASE_URL}/api/chats/{TestChat.chat_id}/messages",
            headers=auth_headers,
            json={"content": "What is 17 + 26? Reply with just the number.", "language": "en"},
            timeout=90,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "user_message" in data and "assistant_message" in data
        assistant_content = data["assistant_message"]["content"]
        assert isinstance(assistant_content, str) and len(assistant_content.strip()) > 0
        # Content check: expect "43"
        assert "43" in assistant_content, f"Expected '43' in reply: {assistant_content!r}"

    def test_04_list_messages(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/chats/{TestChat.chat_id}/messages",
                         headers=auth_headers, timeout=15)
        assert r.status_code == 200
        msgs = r.json()
        assert len(msgs) >= 2
        roles = [m["role"] for m in msgs]
        assert "user" in roles and "assistant" in roles

    def test_05_regenerate(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/chats/{TestChat.chat_id}/regenerate",
                          headers=auth_headers, timeout=90)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["role"] == "assistant"
        assert len(data["content"].strip()) > 0

    def test_06_tamil_language(self, auth_headers):
        # New chat for tamil
        c = requests.post(f"{BASE_URL}/api/chats", headers=auth_headers,
                          json={"title": "Tamil"}, timeout=15).json()
        cid = c["chat_id"]
        r = requests.post(
            f"{BASE_URL}/api/chats/{cid}/messages",
            headers=auth_headers,
            json={"content": "Say hello and introduce yourself briefly.", "language": "ta"},
            timeout=90,
        )
        assert r.status_code == 200, r.text
        reply = r.json()["assistant_message"]["content"]
        # Tamil Unicode range: U+0B80–U+0BFF
        has_tamil = any('\u0B80' <= ch <= '\u0BFF' for ch in reply)
        assert has_tamil, f"Expected Tamil script in reply: {reply!r}"

    def test_07_tanglish(self, auth_headers):
        c = requests.post(f"{BASE_URL}/api/chats", headers=auth_headers,
                          json={"title": "Tanglish"}, timeout=15).json()
        cid = c["chat_id"]
        r = requests.post(
            f"{BASE_URL}/api/chats/{cid}/messages",
            headers=auth_headers,
            json={"content": "Computer science na enna?", "language": "tanglish"},
            timeout=90,
        )
        assert r.status_code == 200, r.text
        reply = r.json()["assistant_message"]["content"]
        assert len(reply.strip()) > 20, f"Reply too short: {reply!r}"
        # Should reference computer/computing concept
        lower = reply.lower()
        assert any(kw in lower for kw in ["comput", "software", "program", "algorith", "தகவல்", "கணினி"]), \
            f"Reply doesn't reference computer science: {reply!r}"

    def test_08_delete_chat(self, auth_headers):
        r = requests.delete(f"{BASE_URL}/api/chats/{TestChat.chat_id}",
                            headers=auth_headers, timeout=15)
        assert r.status_code == 200
        # Verify: subsequent GET messages returns 404
        r2 = requests.get(f"{BASE_URL}/api/chats/{TestChat.chat_id}/messages",
                          headers=auth_headers, timeout=15)
        assert r2.status_code == 404


# ===================== Navigation =====================
class TestNavigation:
    def test_01_usage_default(self, auth_headers, mongo_db, test_user_and_token):
        # Reset nav counters for a clean run
        mongo_db.users.update_one({"user_id": test_user_and_token["user_id"]},
                                  {"$set": {"nav_free_used": 0}})
        mongo_db.nav_daily.delete_many({"user_id": test_user_and_token["user_id"]})
        r = requests.get(f"{BASE_URL}/api/navigation/usage", headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["free_limit"] == 5
        assert data["daily_limit"] == 10
        assert data["daily_used"] == 0
        assert data["free_used"] == 0
        assert data["free_remaining"] == 5

    def test_02_analyze_success(self, auth_headers, real_image_base64):
        r = requests.post(
            f"{BASE_URL}/api/navigation/analyze",
            headers=auth_headers,
            json={
                "image_base64": real_image_base64,
                "question": "What shapes and colors do you see in this image? Be specific.",
                "language": "en",
            },
            timeout=120,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "answer" in data and "usage" in data
        answer = data["answer"].lower()
        assert len(answer.strip()) > 10
        # Image has red circle, yellow rectangle - expect at least one to be mentioned
        assert any(kw in answer for kw in ["circle", "rectangle", "red", "yellow", "square", "shape"]), \
            f"Vision answer doesn't reference image content: {data['answer']!r}"
        # Usage incremented
        assert data["usage"]["daily_used"] >= 1

    def test_03_daily_limit_enforced(self, auth_headers, mongo_db, test_user_and_token, real_image_base64):
        # Manually set nav_daily.count to 10
        from datetime import date
        today = date.today().isoformat()
        mongo_db.nav_daily.update_one(
            {"user_id": test_user_and_token["user_id"], "day": today},
            {"$set": {"count": 10, "user_id": test_user_and_token["user_id"], "day": today}},
            upsert=True,
        )
        r = requests.post(
            f"{BASE_URL}/api/navigation/analyze",
            headers=auth_headers,
            json={
                "image_base64": real_image_base64,
                "question": "What is here?",
                "language": "en",
            },
            timeout=30,
        )
        assert r.status_code == 429, f"Expected 429, got {r.status_code}: {r.text}"
        # Reset
        mongo_db.nav_daily.delete_many({"user_id": test_user_and_token["user_id"]})


# ===================== Schedules =====================
class TestSchedules:
    created_ids = []

    def test_01_create_and_list(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/schedules", headers=auth_headers,
                          json={"task_name": "TEST_task1", "message": "Reminder 1",
                                "date": "2026-06-01", "time": "09:00",
                                "repeat": "none", "enabled": True}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["task_name"] == "TEST_task1"
        assert data["enabled"] is True
        assert "schedule_id" in data
        TestSchedules.created_ids.append(data["schedule_id"])

        r2 = requests.get(f"{BASE_URL}/api/schedules", headers=auth_headers, timeout=15)
        assert r2.status_code == 200
        items = r2.json()
        assert any(x["schedule_id"] == data["schedule_id"] for x in items)

    def test_02_update(self, auth_headers):
        sid = TestSchedules.created_ids[0]
        r = requests.put(f"{BASE_URL}/api/schedules/{sid}", headers=auth_headers,
                         json={"task_name": "TEST_task1_updated", "message": "Updated msg",
                               "date": "2026-06-02", "time": "10:00",
                               "repeat": "daily", "enabled": True}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["task_name"] == "TEST_task1_updated"
        assert data["repeat"] == "daily"

    def test_03_max_5_active_enforced(self, auth_headers, mongo_db, test_user_and_token):
        # Clean existing schedules
        mongo_db.schedules.delete_many({"user_id": test_user_and_token["user_id"]})
        TestSchedules.created_ids.clear()

        # Create 5 enabled
        for i in range(5):
            r = requests.post(f"{BASE_URL}/api/schedules", headers=auth_headers,
                              json={"task_name": f"TEST_s{i}", "message": f"m{i}",
                                    "date": "2026-06-01", "time": "09:00",
                                    "repeat": "none", "enabled": True}, timeout=15)
            assert r.status_code == 200, f"Failed on {i}: {r.text}"
            TestSchedules.created_ids.append(r.json()["schedule_id"])

        # 6th should 400
        r6 = requests.post(f"{BASE_URL}/api/schedules", headers=auth_headers,
                          json={"task_name": "TEST_s6", "message": "m6",
                                "date": "2026-06-01", "time": "09:00",
                                "repeat": "none", "enabled": True}, timeout=15)
        assert r6.status_code == 400, f"Expected 400 for 6th active, got {r6.status_code}: {r6.text}"

    def test_04_delete(self, auth_headers):
        assert TestSchedules.created_ids
        sid = TestSchedules.created_ids[0]
        r = requests.delete(f"{BASE_URL}/api/schedules/{sid}", headers=auth_headers, timeout=15)
        assert r.status_code == 200
        # Verify removed
        items = requests.get(f"{BASE_URL}/api/schedules", headers=auth_headers, timeout=15).json()
        assert not any(x["schedule_id"] == sid for x in items)


# ===================== Settings =====================
class TestSettings:
    def test_01_get_defaults(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/settings", headers=auth_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ui_language"] == "en"
        assert data["theme"] == "dark"
        assert data["voice_enabled"] is True

    def test_02_update_and_persist(self, auth_headers):
        r = requests.put(f"{BASE_URL}/api/settings", headers=auth_headers,
                         json={"ui_language": "ta", "ai_language": "ta",
                               "voice_enabled": False, "voice_name": "Priya",
                               "theme": "light", "privacy_analytics": False}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ui_language"] == "ta"
        assert data["theme"] == "light"
        assert data["voice_enabled"] is False

        # Verify persistence
        r2 = requests.get(f"{BASE_URL}/api/settings", headers=auth_headers, timeout=15)
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["ui_language"] == "ta"
        assert d2["voice_name"] == "Priya"


# ===================== Reports =====================
class TestReports:
    def test_01_create_report(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/reports", headers=auth_headers,
                          json={"category": "ai", "description": "test description"},
                          timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        assert "report_id" in data
        assert data["report_id"].startswith("rep_")
