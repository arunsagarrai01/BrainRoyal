# 🍌 BrainRoyale

A full-stack banana-puzzle quiz game. Players register, solve image-based equations
from the [Banana API](https://marcconrad.com/uob/banana/api.php), earn points, and
compete on a global leaderboard.

Built for a college project demonstrating **version control**, **interoperability**,
**event-driven programming**, and **virtual identity**.

---

## Tech stack

| Layer     | Technology                                              |
| --------- | ------------------------------------------------------- |
| Frontend  | React 19, Vite, React Router, Axios                     |
| Backend   | Node.js, Express 5 (ES modules)                         |
| Database  | PostgreSQL (`pg`) with an embedded PGlite fallback      |
| Auth      | JWT (7-day tokens) + bcrypt password hashing            |
| Styling   | Hand-written CSS (banana theme)                         |

---

## Features

- **Register / Login** with validation, hashed passwords, and JWT sessions
- **Dashboard** with personal best, games played, global stats
- **Game** — every round fetches a fresh puzzle; the answer is checked **server-side**
  so the solution never travels to the browser before you answer
- **Leaderboard** ranked by best score
- **Auto-created schema** on first boot (no manual SQL required)
- **Resilient DB layer** — uses real PostgreSQL when reachable, otherwise falls back to
  an embedded, file-persisted PostgreSQL (PGlite)

---

## Project structure

```
BrainRoyale/
├── client/                  # React + Vite frontend
│   └── src/
│       ├── components/Navbar.jsx
│       ├── context/AuthContext.jsx
│       ├── pages/{Login,Register,Dashboard,Game,Leaderboard}.jsx
│       ├── api.js           # Axios instance + JWT interceptor
│       └── App.jsx
├── server/                  # Express backend
│   ├── config/db.js         # pg Pool + PGlite fallback
│   ├── controllers/         # auth + game logic
│   ├── db/{init.js,schema.sql}
│   ├── middleware/auth.js   # JWT guard
│   ├── routes/
│   ├── scripts/test-api.mjs # end-to-end API tests
│   ├── utils/{jwt.js,questionStore.js}
│   └── index.js
├── .gitignore
├── package.json             # root convenience scripts
└── README.md
```

---

## Getting started

### 1. Install dependencies

```bash
cd server && npm install
cd ../client && npm install
```

### 2. Configure environment

```bash
cd server
cp .env.example .env
```

### 3. Run

```bash
# terminal 1
npm run dev:server      # http://localhost:5000

# terminal 2
npm run dev:client      # http://localhost:5173
```

The server prints which database driver it is using:

```
[db] Using PostgreSQL via DATABASE_URL
# or
[db] Using embedded PostgreSQL (PGlite) at server/.pgdata
```

**Using real PostgreSQL:** create the database once, then start the server — tables
are created automatically.

```sql
CREATE DATABASE brainroyale;
```

If your PostgreSQL server is unavailable, the backend still starts using the embedded
database (`DB_DRIVER=auto`, `DB_FALLBACK=true`). Set `DB_DRIVER=pglite` to force the
embedded database, or `DB_FALLBACK=false` to fail fast instead.

### Demo account

| Email                | Password  |
| -------------------- | --------- |
| `banana@example.com` | `banana123` |

---

## API reference

Base URL: `http://localhost:5000`

| Method | Endpoint                 | Auth | Description                                      |
| ------ | ------------------------ | ---- | ------------------------------------------------ |
| GET    | `/`                      | –    | API info + endpoint list                         |
| GET    | `/api/health`            | –    | Health check + active DB driver                  |
| POST   | `/api/auth/register`     | –    | Create account → `{ token, user }`               |
| POST   | `/api/auth/login`        | –    | Sign in → `{ token, user }`                      |
| GET    | `/api/auth/me`           | ✅   | Profile with `best_score` and `games_played`     |
| GET    | `/api/game/question`     | –    | `{ questionId, question, expiresIn }`            |
| POST   | `/api/game/answer`       | –    | `{ questionId, answer }` → `{ correct, solution }` |
| POST   | `/api/game/score`        | ✅   | `{ score }` → `{ bestScore }`                    |
| GET    | `/api/game/leaderboard`  | –    | Top 50 players                                   |
| GET    | `/api/game/stats`        | –    | Dashboard counters                               |

Authentication uses `Authorization: Bearer <token>`.

### Banana API integration

`GET https://marcconrad.com/uob/banana/api.php` returns:

```json
{
  "question": "https://www.sanfoh.com/uob/banana/data/txxxxx.png",
  "solution": 6
}
```

The backend keeps `solution` in a short-lived in-memory store keyed by `questionId`
(5-minute TTL, single use) and only returns it after the player answers.

---

## Testing

End-to-end suite covering every endpoint (22 assertions):

```bash
# terminal 1 – test server on a separate port and database
cd server
$env:PORT=5001; $env:NODE_ENV="test"; $env:DB_DRIVER="pglite"
$env:PGLITE_DIR="$(Get-Location)\.pgdata-test"
node index.js

# terminal 2
$env:API_URL="http://localhost:5001"
npm run test:api
```

On macOS/Linux:

```bash
PORT=5001 NODE_ENV=test DB_DRIVER=pglite PGLITE_DIR=./.pgdata-test node index.js
API_URL=http://localhost:5001 npm run test:api
```

Expected result:

```
22 passed, 0 failed
```

---

## How the college criteria are met

| Criterion                     | Implementation                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------ |
| **Version control**           | Git repository with `.gitignore`, structured commits, no secrets committed     |
| **Interoperability**          | REST API between React and Express; consumes the external Banana API; JSON contracts; CORS-enabled |
| **Event-driven programming**  | React event handlers and state updates; Express middleware pipeline; async request/response events; socket-ready architecture |
| **Virtual identity**          | User accounts with bcrypt-hashed passwords, signed JWTs, protected routes, per-user scores and leaderboard identity |

---

## Notes

- `.env` is intentionally untracked. Use `.env.example` as the template.
- The embedded database is stored in `server/.pgdata` (ignored by Git).
- `NODE_ENV=test` additionally exposes the puzzle solution so automated tests can
  verify the correct-answer path. It is never exposed in development or production.
