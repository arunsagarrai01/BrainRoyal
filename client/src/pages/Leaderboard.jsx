import { useState, useEffect } from "react";
import api from "../api";

const Leaderboard = () => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get("/game/leaderboard")
      .then((res) => {
        setLeaderboard(res.data.leaderboard);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ maxWidth: "600px", margin: "2rem auto", padding: "2rem" }}>
      <h1 style={{ textAlign: "center" }}>Leaderboard</h1>
      {loading && <p>Loading...</p>}
      {!loading && leaderboard.length === 0 && <p>No scores yet. Be the first!</p>}
      {!loading && leaderboard.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f4f4f4" }}>
              <th style={{ padding: "0.75rem", textAlign: "left", border: "1px solid #ddd" }}>Rank</th>
              <th style={{ padding: "0.75rem", textAlign: "left", border: "1px solid #ddd" }}>Player</th>
              <th style={{ padding: "0.75rem", textAlign: "left", border: "1px solid #ddd" }}>High Score</th>
              <th style={{ padding: "0.75rem", textAlign: "left", border: "1px solid #ddd" }}>Games Played</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((entry, index) => (
              <tr key={index}>
                <td style={{ padding: "0.75rem", border: "1px solid #ddd" }}>{index + 1}</td>
                <td style={{ padding: "0.75rem", border: "1px solid #ddd" }}>{entry.username}</td>
                <td style={{ padding: "0.75rem", border: "1px solid #ddd" }}>{entry.max_score}</td>
                <td style={{ padding: "0.75rem", border: "1px solid #ddd" }}>{entry.games_played}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default Leaderboard;
