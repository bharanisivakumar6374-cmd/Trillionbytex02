# Auth-Gated App Testing Playbook

## Step 1: Create Test User & Session in MongoDB
Use mongosh to insert a user document with `user_id` (custom UUID, not `_id`) and a matching `user_sessions` document with session_token, expires_at (7 days).

## Step 2: Test Backend
- `GET /api/auth/me` with `Authorization: Bearer <session_token>` should return user
- All protected endpoints should accept Bearer token

## Step 3: Browser Testing
Set `session_token` cookie for the domain, then visit protected routes.

## Rules
- Always exclude `_id` with `{"_id": 0}` projection
- Always use timezone-aware datetimes
- Session cookie: httpOnly, secure, samesite=none
