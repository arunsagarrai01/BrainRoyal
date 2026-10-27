import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Navbar = () => {
  const { user, logout } = useAuth();

  return (
    <nav style={{ padding: "1rem", background: "#222", color: "#fff", display: "flex", gap: "1rem", alignItems: "center" }}>
      <h3 style={{ marginRight: "auto" }}>BrainRoyale</h3>
      <Link to="/dashboard" style={{ color: "#fff" }}>Dashboard</Link>
      <Link to="/game" style={{ color: "#fff" }}>Play Game</Link>
      <Link to="/leaderboard" style={{ color: "#fff" }}>Leaderboard</Link>
      {user ? (
        <>
          <span>Hi, {user.username}</span>
          <button onClick={logout}>Logout</button>
        </>
      ) : (
        <>
          <Link to="/login" style={{ color: "#fff" }}>Login</Link>
          <Link to="/register" style={{ color: "#fff" }}>Register</Link>
        </>
      )}
    </nav>
  );
};

export default Navbar;
