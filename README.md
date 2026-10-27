# BrainRoyale

A web-based quiz game where players solve banana puzzle questions fetched from the Banana API. Built with React + Vite, Express.js, and PostgreSQL.

## Features

- User authentication (Login/Register)
- Dashboard to access game and leaderboard
- Play brain teaser game - solve image-based puzzles
- Leaderboard to track top scores
- Integration with Banana API for questions

## Tech Stack

- **Frontend**: React, Vite, React Router, Axios
- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL
- **Authentication**: JWT, bcryptjs

## Project Structure

```
BrainRoyale/
├── client/          # React + Vite frontend
├── server/          # Express backend
│   ├── config/      # Database configuration
│   ├── controllers/ # Route controllers
│   ├── db/          # Database schema
│   ├── middleware/  # Auth middleware
│   ├── routes/      # API routes
│   └── utils/       # Utility functions
└── shared/          # Shared code
```

## Setup Instructions

### Prerequisites

- Node.js (v16+)
- PostgreSQL installed and running

### Database Setup

1. Create a PostgreSQL database named `brainroyale`
2. Run the schema from `server/db/schema.sql`

```sql
CREATE DATABASE brainroyale;
```

Then run the schema file.

### Backend Setup

```bash
cd server
npm install
# Update .env with your database credentials
npm run dev
```

### Frontend Setup

```bash
cd client
npm install
npm run dev
```

The app will run on:
- Frontend: http://localhost:5173
- Backend: http://localhost:5000

## API Endpoints

### Auth
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (protected)

### Game
- `GET /api/game/question` - Fetch question from Banana API
- `POST /api/game/score` - Submit score (protected)
- `GET /api/game/leaderboard` - Get leaderboard

## Banana API

Uses [https://marcconrad.com/uob/banana/api.php](https://marcconrad.com/uob/banana/api.php) which returns:
```json
{
  "question": "https://example.com/image.png",
  "solution": 6
}
```
The game displays the image as question and expects numeric answer matching solution.

## Meeting College Criteria

- **Version Control**: Git repository initialized
- **Interoperability**: RESTful API connecting React frontend with Express backend, integrates external Banana API
- **Event-Driven Programming**: React event handlers, Express middleware, async/await event handling
- **Virtual Identity**: User authentication with JWT tokens and secure password hashing with bcrypt
