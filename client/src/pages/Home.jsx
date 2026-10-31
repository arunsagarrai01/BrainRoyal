import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";

/**
 * Public landing page.
 *
 * This is the first page a visitor sees. It explains the game and offers the two
 * entry points (Login / Create account). The game itself lives behind the
 * `PrivateRoute` guard in App.jsx, so an anonymous visitor can look around but
 * cannot play until they sign in.
 */
const Home = () => {
  const { user, loading } = useAuth();
  const [stats, setStats] = useState(null);

  // Public counters, purely decorative: if the API is unreachable we simply
  // hide the numbers instead of showing an error on the landing page.
  useEffect(() => {
    api
      .get("/game/stats")
      .then(({ data }) => setStats(data))
      .catch(() => setStats(null));
  }, []);

  const statItems = [
    { key: "totalPlayers", label: "Players", icon: "👥" },
    { key: "totalGames", label: "Rounds played", icon: "🎮" },
    { key: "totalQuestions", label: "Puzzles solved", icon: "🧠" },
    { key: "topScore", label: "Top score", icon: "🏆" },
  ];

  return (
    <div className="page">
      <section className="hero">
        <div>
          <span className="hero__eyebrow">🍌 The Ultimate Puzzle Challenge</span>
          <h1>Solve bananas. Climb the leaderboard.</h1>
          <p>
            Every round shows a fresh banana equation — work out the missing
            number before the timer runs out. Three lives, one streak, and a
            global ranking waiting for you.
          </p>

          <div className="hero__actions">
            {/* Wait for the session lookup before choosing between the visitor
                and player call-to-action, so the buttons never flicker. */}
            {loading ? (
              <span className="home-cta-skeleton" aria-hidden="true" />
            ) : user ? (
              <>
                <Link to="/game" className="btn btn--dark">
                  ▶ Continue playing
                </Link>
                <Link to="/dashboard" className="btn btn--ghost">
                  My dashboard
                </Link>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn--dark">
                  Login to play
                </Link>
                <Link to="/register" className="btn btn--ghost">
                  Create an account
                </Link>
              </>
            )}
          </div>

          {/* Makes the access rule explicit for visitors who are not signed in. */}
          {!loading && !user && (
            <p className="home-gate">
              🔒 Playing, saving scores and the leaderboard require an account.
            </p>
          )}
        </div>

        <div className="hero__art" aria-hidden="true">
          🍌
        </div>
      </section>

      {stats && (
        <div className="grid grid--stats">
          {statItems.map((item) => (
            <div className="card card--stat" key={item.key}>
              <span className="stat__icon">{item.icon}</span>
              <span className="stat__label">{item.label}</span>
              <span className="stat__value">{stats[item.key] ?? 0}</span>
            </div>
          ))}
        </div>
      )}

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
            Solve the equation before the 30-second timer reaches zero.
          </p>
        </div>
        <div className="card">
          <h3>3. Beat the board</h3>
          <p className="muted">
            Three lives, streaks and accuracy. Your best score is saved forever.
          </p>
        </div>
      </div>

      {!loading && !user && (
        <section className="home-cta">
          <div>
            <h2>Ready to start?</h2>
            <p className="muted">
              It takes less than a minute — all you need is an email address.
            </p>
          </div>
          <div className="home-cta__actions">
            <Link to="/register" className="btn btn--primary">
              Create your account
            </Link>
            <Link to="/login" className="btn btn--ghost">
              I already have one
            </Link>
          </div>
        </section>
      )}
    </div>
  );
};

export default Home;
