# 🔥 FitLens — AI-Powered Calorie Tracking App

FitLens is a full-stack mobile application for intelligent nutrition tracking. Take a photo of your meal and let Gemini Vision AI identify the food and estimate portions — macros appear in seconds.

---

## 🗂 Project Structure

```
caloriesTrackingApp/
├── backend/          # Fastify API server
│   └── src/
│       ├── index.ts          # Server entry point
│       ├── db/
│       │   ├── client.ts     # PostgreSQL connection
│       │   └── schema.sql    # Full DB schema + triggers
│       ├── routes/
│       │   ├── auth.ts       # Register / Login / Refresh
│       │   ├── users.ts      # Profile & Goals
│       │   ├── foods.ts      # Search (Nutritionix + Redis cache)
│       │   ├── logs.ts       # Manual & image logging
│       │   ├── dashboard.ts  # Aggregations & streak
│       │   └── websocket.ts  # Real-time push
│       ├── services/
│       │   ├── gemini.ts     # Gemini 1.5 Flash Vision
│       │   ├── nutritionix.ts# NLP macro lookup
│       │   ├── redis.ts      # ioredis singleton
│       │   ├── queue.ts      # BullMQ vision queue
│       │   ├── storage.ts    # Supabase Storage image upload
│       │   ├── wsEmitter.ts  # In-process EventEmitter
│       │   └── logHelpers.ts # getOrCreateDailyLog
│       └── workers/
│           └── visionWorker.ts # BullMQ consumer (Gemini → Nutritionix → WS push)
│
└── mobile/           # Expo React Native app
    ├── app/
    │   ├── _layout.tsx            # Root layout + Auth gate
    │   ├── (auth)/
    │   │   ├── login.tsx
    │   │   └── register.tsx
    │   ├── (tabs)/
    │   │   ├── _layout.tsx        # Bottom tab navigator
    │   │   ├── dashboard.tsx      # Today's summary
    │   │   ├── history.tsx        # Weekly bar chart + logs
    │   │   └── profile.tsx        # Goals & sign-out
    │   └── log/
    │       └── index.tsx          # Log food (camera / search)
    └── src/
        ├── constants/theme.ts     # Design tokens
        ├── lib/api.ts             # Axios + JWT interceptors
        ├── store/
        │   ├── authStore.ts       # Zustand auth
        │   └── logStore.ts        # Zustand log entries
        ├── screens/               # Screen implementations
        └── components/
            ├── MacroRing.tsx      # SVG circular progress
            ├── MealSection.tsx    # Per-meal card
            └── WaterTracker.tsx   # Water glass tracker
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)
- A [Redis](https://upstash.com) instance (Upstash free tier works)
- [Google AI Studio](https://aistudio.google.com) API key (Gemini)
- [Nutritionix](https://www.nutritionix.com/business/api) API credentials

---

### 1. Backend Setup

```bash
cd backend
cp .env.example .env
# Fill in all values in .env

npm install

# Apply database schema
psql $DATABASE_URL -f src/db/schema.sql

# Start dev server
npm run dev
```

---

### 2. Mobile Setup

```bash
cd mobile
npm install

# Set your API URL
echo "EXPO_PUBLIC_API_URL=http://localhost:3000" > .env.local

# Start Expo
npm start
# Press 'i' for iOS simulator, 'a' for Android
```

---

## 🔑 Environment Variables (Backend)

| Variable | Description |
|---|---|
| `PORT` | API server port (default: 3000) |
| `JWT_SECRET` | Secret for signing JWTs |
| `DATABASE_URL` | PostgreSQL connection string |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key |
| `REDIS_URL` | Redis connection URL |
| `GEMINI_API_KEY` | Google Gemini API key |
| `NUTRITIONIX_APP_ID` | Nutritionix App ID |
| `NUTRITIONIX_API_KEY` | Nutritionix API key |
| `STORAGE_BUCKET` | Supabase Storage bucket name |

---

## 🏗 Architecture

```
📱 Expo App (React Native)
    │
    ├── Zustand stores (auth, log)
    ├── React Query (server state)
    └── WebSocket (real-time updates)
         │
         ▼
🔀 Fastify API (Node.js)
    │
    ├── JWT Auth middleware
    ├── Rate limiting (200 req/min)
    └── Routes: auth, users, foods, logs, dashboard
         │
    ┌────┴─────────────────────┐
    │                          │
    ▼                          ▼
🗄 PostgreSQL              📬 BullMQ Queue
  (Supabase)                (Redis)
    │                          │
    ▼                          ├── Gemini Flash Vision
💾 Redis Cache              ├── Nutritionix NLP
  (food macros,             └── WebSocket Push
   dashboard)
```

---

## ⚡️ Latency Strategy

| Technique | Effect |
|---|---|
| Optimistic UI | Skeleton card appears instantly (0ms) |
| Redis food cache | Skip Nutritionix for known items |
| Gemini Flash | 3× faster than Pro |
| CDN image resize | Smaller payload to Vision API |
| Single batch Nutritionix | N items → 1 API call |
| WebSocket push | Server pushes result, no polling |
| Manual fallback | If >10s, editable AI draft is shown |

---

## 📝 License

MIT
