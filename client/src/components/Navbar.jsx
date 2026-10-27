import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="navbar">
      <div className="navbar__inner">
        <Link to="/" className="navbar__brand">
          <span role="img" aria-label="banana">
            🍌
          </span>
          BrainRoyale
        </Link>

        <div className="navbar__links">
          <NavLink to="/dashboard" className="navbar__link">
            Dashboard
          </NavLink>
          <NavLink to="/game" className="navbar__link">
            Play
          </NavLink>
          <NavLink to="/leaderboard" className="navbar__link">
            Leaderboard
          </NavLink>

          {user ? (
            <>
              <span className="navbar__user">
                <span className="navbar__avatar">
                  {user.username?.charAt(0).toUpperCase()}
                </span>
                {user.username}
              </span>
              <button className="btn btn--ghost btn--small" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn--ghost btn--small">
                Login
              </Link>
              <Link to="/register" className="btn btn--primary btn--small">
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
