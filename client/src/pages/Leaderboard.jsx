import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";

const medal = (rank) => (rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank);

const Leaderboard = () => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/game/leaderboard")
      .then(({ data }) => setRows(data.leaderboard))
      .catch((err) =>
        setError(err.response?.data?.message || "Could not load the leaderboard.")
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page page--narrow">
      <div className="game-head">
        <div>
          <h1 style={{ margin: 0 }}>Leaderboard</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            Highest scores across BrainRoyale.
          </p>
        </div>
        <Link to="/game" className="btn btn--primary btn--small">
          Play now
        </Link>
      </div>

      {error && <div className="error-banner">{error}</div>}
      {loading && <p className="muted">Loading scores…</p>}

      {!loading && rows.length === 0 && !error && (
        <div className="card empty-state">
          <span className="empty-state__emoji">🍌</span>
          No scores yet. Be the first champion!
          <div style={{ marginTop: 14 }}>
            <Link to="/game" className="btn btn--primary btn--small">
              Start playing
            </Link>
          </div>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="table-wrap">
          <table className="leaderboard">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Player</th>
                <th>Best Score</th>
                <th>Games</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.username}>
                  <td className={`rank ${row.rank === 1 ? "rank--gold" : ""}`}>
                    {medal(row.rank)}
                  </td>
                  <td>
                    <span className="player">
                      <span className="player__avatar">
                        {row.username.charAt(0).toUpperCase()}
                      </span>
                      {row.username}
                    </span>
                  </td>
                  <td style={{ fontWeight: 800 }}>{row.maxScore}</td>
                  <td className="muted">{row.gamesPlayed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
