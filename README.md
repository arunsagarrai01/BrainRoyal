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
| Auth      | Server-side sessions (httpOnly cookie) + bcrypt hashing  |
| Styling   | Hand-written CSS (banana theme)                         |

---

## Features

### Accounts & security

- **Register / Login** with validation, bcrypt password hashing
- **"Remember me"** — a normal sign-in uses a session cookie that disappears when the
  browser closes; "Remember me" keeps you signed in for 30 days
- **CAPTCHA** — a server-generated arithmetic challenge (single use, 5-minute TTL)
  guards every login attempt
- **Login attempt limitation** — 5 wrong passwords for an account locks it for 15
  minutes; 20 wrong passwords from one IP locks that address for 15 minutes. Both
  counters live in the database, so restarting the server does not reset them
- **Server-side sessions** — the cookie (`br_session`) is `httpOnly` + `sameSite=lax`
  and only a SHA-256 hash of the token is stored in the database
- **Profile page** — edit username/email, change password, review active sessions,
  sign out individual devices or everywhere
- **Password visibility toggle** (eye button) on every password input
- **Authentication vs. authorization** — `requireAuth` proves who you are,
  `requireRole("admin")` / ownership checks decide what you may do

### Game

- Fresh banana puzzle each round, checked **server-side**
- **3 lives** — a wrong answer or the 30-second timer running out costs one
- **30s countdown bar** per puzzle with a warning state in the last 5 seconds
- **Pause / resume** (button or the `P` key) — freezes the timer, not just the display
- **Retry** — restart a run at any time; the current score is saved first
- **Quit** — confirmation dialog, saves the score and returns to the dashboard
- **Streak counter**, best streak, and accuracy shown on the game-over screen
- **Keyboard shortcuts** — digits to type, `Enter` to submit, `P` to pause, `Esc` to resume
- **Sound effects** (generated with WebAudio, no audio files) with a mute toggle
- **Leaderboard** ranked by best score, plus dashboard stats

### Platform

- **Light & dark themes** — a toggle in the navbar switches the whole app
  (home, auth, game, profile, dialogs). The choice is saved per device in
  `localStorage` and applied before the first paint, so there is no white flash;
  a first-time visitor gets whichever theme their operating system prefers
- **Home page** — a public landing page shown at `/`; visitors can read about the
  game and sign in, but every gameplay route is guarded and redirects to the login page
- **Dashboard** with personal best, games played, global stats
- **Auto-created schema** on first boot (no manual SQL required)
- **Resilient DB layer** — uses real PostgreSQL when reachable, otherwise falls back to
  an embedded, file-persisted PostgreSQL (PGlite)

---

## Project structure

```
BrainRoyale/
├── client/                  # React + Vite frontend
│   └── src/
│       ├── components/{Navbar,PasswordField,CaptchaField,ConfirmDialog}.jsx
│       ├── context/AuthContext.jsx
│       ├── context/ThemeContext.jsx   # light/dark theme + persistence
│       ├── pages/{Home,Login,Register,Dashboard,Game,Leaderboard,Profile}.jsx
│       ├── utils/sound.js   # WebAudio blips for the game
│       ├── api.js           # Axios instance (cookies) + 401 interceptor
│       └── App.jsx          # private / public-only route guards
├── server/                  # Express backend
│   ├── config/db.js         # pg Pool + PGlite fallback
│   ├── controllers/         # auth + game logic
│   ├── db/{init.js,schema.sql}
│   ├── middleware/auth.js   # requireAuth / requireSelf / requireRole
│   ├── routes/
│   ├── services/            # sessions.js, loginAttempts.js
│   ├── scripts/test-api.mjs # end-to-end API tests
│   ├── utils/{cookies,captchaStore,questionStore}.js
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
npm run dev:server      # http://localhost:5001

# terminal 2
npm run dev:client      # http://localhost:5173
```

> **Ports:** the API listens on `PORT` from `server/.env` (default `5001`) because
> PostgreSQL is installed on `5000` on some machines. The browser client reads the API
> URL from `VITE_API_URL` (`client/.env`, default `http://localhost:5001/api`). Keep
> the two in sync if you change either one.

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

Then point `DATABASE_URL` in `server/.env` at the host/port your PostgreSQL server
actually listens on, for example
`postgres://postgres:password@localhost:5432/brainroyale`.

If your PostgreSQL server is unavailable, the backend still starts using the embedded
database (`DB_DRIVER=auto`, `DB_FALLBACK=true`). Set `DB_DRIVER=pglite` to force the
embedded database, or `DB_FALLBACK=false` to fail fast instead.

### Demo account

There is no seeded account — open the home page and choose **Create an account**.
New passwords must be at least 8 characters and contain a letter and a number.

---

## API reference

Base URL: `http://localhost:5001`

| Method | Endpoint                          | Auth        | Description                                            |
| ------ | --------------------------------- | ----------- | ------------------------------------------------------ |
| GET    | `/`                               | –           | API info + endpoint list                               |
| GET    | `/api/health`                     | –           | Health check + active DB driver                        |
| GET    | `/api/auth/captcha`               | –           | New arithmetic challenge `{ captchaId, question }`     |
| POST   | `/api/auth/register`              | –           | Create account (sets the session cookie)               |
| POST   | `/api/auth/login`                 | –           | `{ email, password, remember, captchaId, captchaAnswer }` |
| POST   | `/api/auth/logout`                | ✅          | End this session                                       |
| POST   | `/api/auth/logout-all`            | ✅          | End every session                                      |
| GET    | `/api/auth/me`                    | ✅          | Profile + session info                                 |
| PATCH  | `/api/auth/me`                    | ✅          | Update own username / email                            |
| POST   | `/api/auth/change-password`       | ✅          | Rotate password, sign out other devices                |
| GET    | `/api/auth/sessions`              | ✅          | Active devices                                         |
| DELETE | `/api/auth/sessions/:id`          | ✅ (owner)  | Sign out one device                                    |
| GET    | `/api/auth/admin/users`           | ✅ (admin)  | List every user — demonstrates role checks             |
| GET    | `/api/game/question`              | –           | `{ questionId, question, expiresIn, solution? }`       |
| POST   | `/api/game/answer`                | –           | `{ questionId, answer }` → `{ correct, solution }`     |
| POST   | `/api/game/score`                 | ✅          | `{ score, runId? }` → `{ runId, bestScore }`           |
| GET    | `/api/game/leaderboard`           | –           | Top 50 players                                         |
| GET    | `/api/game/stats`                 | –           | Dashboard counters                                     |

Browsers authenticate with the **httpOnly `br_session` cookie**; the browser sends it
automatically (`withCredentials: true`). API clients and the test suite may instead
send `Authorization: Bearer <session-token>`.

### Page access

| Route          | Who can open it                                    |
| -------------- | -------------------------------------------------- |
| `/`            | everyone — public landing page (no gameplay)       |
| `/login`       | visitors only; signed-in users go to the dashboard |
| `/register`    | visitors only                                      |
| `/dashboard`   | signed-in users                                    |
| `/game`        | signed-in users — the actual quiz                  |
| `/leaderboard` | signed-in users                                    |
| `/profile`     | signed-in users                                    |

The client guards these with `PrivateRoute` / `PublicOnlyRoute`, and the API enforces
the same rules independently, so hiding a link is never the only protection.

### How a run is scored

A play-through is identified by a `runId`. The first `POST /api/game/score` of a
run omits it, and the server returns a fresh id. Every later save of the same run
sends that id back, so the row is updated instead of duplicated:

```jsonc
// first correct answer -> new run
POST /api/game/score  { "score": 1 }
                     -> 201 { "runId": "b0f1…", "bestScore": 1 }

// next correct answer -> same run
POST /api/game/score  { "score": 2, "runId": "b0f1…" }
                     -> 201 { "runId": "b0f1…", "bestScore": 2 }
```

The leaderboard therefore reflects progress after **every** correct answer, while
`games_played` still counts one row per run.

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

The end-to-end suite covers every endpoint — CAPTCHA, remember-me cookies, sessions,
lockout, profile updates, password changes, authorization and run/scoring behaviour
(48 assertions). It keeps a small cookie jar, because authentication is cookie-based.

```bash
# terminal 1 – server under test on a separate port
cd server
$env:PORT=5002
node index.js

# terminal 2
cd server
$env:API_URL="http://localhost:5002"
node scripts/test-api.mjs
```

You can also run it against the normal dev server (`http://localhost:5001`). The suite
creates throw-away users whose emails start with `tester_`, `lock_` or `weak_`; delete
them afterwards if you want a clean leaderboard.

On macOS/Linux:

```bash
PORT=5002 node index.js
API_URL=http://localhost:5002 node scripts/test-api.mjs
```

Expected result:

```
48 passed, 0 failed
```

> `SHOW_ANSWERS=true` (also enabled automatically when `NODE_ENV=test`) adds
> `solution` to `GET /api/game/question`, which lets the browser console print the
> answer and lets the suite test the correct-answer path. Set it to `false` to hide
> the answer outside tests.

---

## How the college criteria are met

| Criterion                     | Implementation                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------ |
| **Version control**           | Git repository with `.gitignore`, structured commits, no secrets committed     |
| **Interoperability**          | REST API between React and Express; consumes the external Banana API; JSON contracts; CORS-enabled |
| **Event-driven programming**  | React event handlers and state updates; Express middleware pipeline; async request/response events; socket-ready architecture |
| **Virtual identity**          | User accounts with bcrypt-hashed passwords, server-side sessions in httpOnly cookies, CAPTCHA + lockout, role-based authorization, per-user scores and leaderboard identity |

---

## Notes

- `.env` is intentionally untracked. Use `.env.example` as the template.
- The embedded database is stored in `server/.pgdata` (ignored by Git).
- Colours come from CSS variables in `client/src/index.css`. To add another theme
  (for example high-contrast), add a `:root[data-theme="…"]` block with the same
  variable names and expose it from `ThemeContext`.
- `NODE_ENV=test` additionally exposes the puzzle solution so automated tests can
  verify the correct-answer path. It is never exposed in development or production.
