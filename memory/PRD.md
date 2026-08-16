# Zero Two AI — PRD

## Original Problem Statement
Build **Zero Two AI**, a premium multilingual AI assistant web app with a ChatGPT-like interface. Core: Chat + Voice Chat + **Navigation Mode** (screen-share + AI explanation) + Schedules + Settings + Help + Reports. Premium black + gold futuristic UI, glassmorphism, responsive.

## Architecture
- **Frontend**: React 19 + React Router 7 + Tailwind + Shadcn UI, Manrope + Outfit fonts, black+gold theme
- **Backend**: FastAPI + Motor (MongoDB async), emergentintegrations `LlmChat` w/ `gemini-3-flash-preview`
- **Auth**: Emergent-managed Google OAuth (cookie + Bearer)
- **Voice**: Browser Web Speech API (STT + TTS, all 15 languages)
- **Screen capture**: `navigator.mediaDevices.getDisplayMedia()` → canvas → JPEG base64
- **DB collections**: users, user_sessions, chats, messages, schedules, settings, reports, nav_daily, nav_events

## User Personas
- Bilingual/multilingual power users needing quick, translated explanations
- Students/researchers using Navigation to explain on-screen content
- Productivity users scheduling recurring reminders

## Core Requirements (Static)
- 15 languages + Auto Detect (understands mixed like "Computer science na enna?")
- 5 free Navigation uses after first login, 10/day max — enforced **server-side**
- Max 5 active schedules — enforced server-side
- Voice ON/OFF, voice selection, dark/light theme, privacy settings
- Report categories: ai, navigation, voice, translation, other

## What's Implemented (2026-02)
- Google OAuth login + session cookie/Bearer
- Chat: new, list, send (streams via Gemini 3 Flash), copy, regenerate, delete, per-message language + voice
- Voice input (STT) + voice output (TTS) with language codes for all 15 languages
- Navigation Mode: share screen → capture frame → ask (voice or text) → AI explains in chosen language → optional TTS
- Server-enforced Navigation limits (429 on daily cap)
- Schedules CRUD w/ 5-active cap
- Settings (persistent), Help (FAQ accordion), Report submission
- Premium black + gold UI, glassmorphism sidebar, usage counter, mobile responsive
- 22/22 backend tests passing (real LLM + vision verified)

## Backlog (P1/P2)
- P1: Schedule executor (currently records-only; no notification firing yet)
- P1: Streaming responses via SSE for chat/navigation
- P2: Export chat history
- P2: Multi-frame Navigation (compare before/after)
- P2: Shareable Navigation answers (public link)
- P2: Emergent Stripe billing for paid Navigation tier
