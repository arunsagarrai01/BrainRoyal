import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Dashboard = () => {
  const { user } = useAuth();

  return (
    <div style={{ maxWidth: "800px", margin: "2rem auto", padding: "2rem", textAlign: "center" }}>
      <h1>Welcome to BrainRoyale, {user?.username}!</h1>
      <p>Test your brain with banana puzzles</p>
      <div style={{ marginTop: "2rem", display: "flex", gap: "1rem", justifyContent: "center" }}>
        <Link to="/game">
          <button style={{ padding: "1rem 2rem", fontSize: "1.1rem" }}>Play Game</button>
        </Link>
        <Link to="/leaderboard">
          <button style={{ padding: "1rem 2rem", fontSize: "1.1rem" }}>View Leaderboard</button>
        </Link>
      </div>
    </div>
  );
};

export default Dashboard;
