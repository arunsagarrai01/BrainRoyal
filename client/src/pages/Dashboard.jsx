import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";

const statCards = [
  { key: "totalPlayers", label: "Players", icon: "👥" },
  { key: "totalGames", label: "Games Played", icon: "🎮" },
  { key: "totalQuestions", label: "Registered Brains", icon: "🧠" },
  { key: "topScore", label: "Top Score", icon: "🏆" },
];

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    api
      .get("/game/stats")
      .then(({ data }) => setStats(data))
      .catch(() => setStats(null));

    api
      .get("/auth/me")
      .then(({ data }) => setProfile(data.user))
      .catch(() => setProfile(null));
  }, []);

  return (
    <div className="page">
      <section className="hero">
        <div>
          <span className="hero__eyebrow">🍌 The Ultimate Puzzle Challenge</span>
          <h1>Hey {user?.username}, ready to play?</h1>
          <p>
            Every round gives you a brand new banana puzzle. Find the missing
            number, keep your streak alive, and climb the leaderboard.
          </p>
          <div className="hero__actions">
            <Link to="/game" className="btn btn--dark">
              ▶ Start Quiz
            </Link>
            <Link to="/leaderboard" className="btn btn--ghost">
              View Leaderboard
            </Link>
          </div>
        </div>
        <div className="hero__art" aria-hidden="true">
          🍌
        </div>
      </section>

      <div className="grid grid--stats">
        <div className="card card--stat">
          <span className="stat__icon">⭐</span>
          <span className="stat__label">Your Best Score</span>
          <span className="stat__value">
            {profile ? Number(profile.best_score) : "—"}
          </span>
        </div>
        <div className="card card--stat">
          <span className="stat__icon">🎯</span>
          <span className="stat__label">Games Played</span>
          <span className="stat__value">
            {profile ? Number(profile.games_played) : "—"}
          </span>
        </div>
        {[statCards[0], statCards[3]].map((card) => (
          <div className="card card--stat" key={card.key}>
            <span className="stat__icon">{card.icon}</span>
            <span className="stat__label">{card.label}</span>
            <span className="stat__value">{stats ? stats[card.key] : "—"}</span>
          </div>
        ))}
      </div>

      <h2 className="section-title">🍌 How it works</h2>
      <div className="grid grid--stats">
        <div className="card">
          <h3>1. Get a puzzle</h3>
          <p className="muted">
            A fresh equation image is loaded from the Banana API every round.
          </p>
        </div>
        <div className="card">
          <h3>2. Find the number</h3>
          <p className="muted">
            Work out the missing value and submit your answer.
          </p>
        </div>
        <div className="card">
          <h3>3. Beat the board</h3>
          <p className="muted">
            One wrong answer ends the run. Your best score is saved forever.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
