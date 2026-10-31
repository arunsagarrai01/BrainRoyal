import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const Navbar = () => {
  const { user, logout, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout(); // clears the server session and the httpOnly cookie
    navigate("/", { replace: true });
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
          {/* While the session is being restored we render nothing, so the bar
              never flashes "Login" for a user who is actually signed in. */}
          {loading && <span className="navbar__placeholder" aria-hidden="true" />}

          {/* Game navigation is for signed-in players only; visitors get the
              public entry points, so no link leads to a protected page. */}
          {!loading &&
            (user ? (
              <>
                <NavLink to="/dashboard" className="navbar__link">
                  Dashboard
                </NavLink>
                <NavLink to="/game" className="navbar__link">
                  Play
                </NavLink>
                <NavLink to="/leaderboard" className="navbar__link">
                  Leaderboard
                </NavLink>
                <NavLink to="/profile" className="navbar__link">
                  Profile
                </NavLink>

                <Link to="/profile" className="navbar__user" title="Your profile">
                  <span className="navbar__avatar">
                    {user.username?.charAt(0).toUpperCase()}
                  </span>
                  {user.username}
                </Link>

                <button
                  className="btn btn--ghost btn--small"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <NavLink to="/" end className="navbar__link">
                  Home
                </NavLink>
                <Link to="/login" className="btn btn--ghost btn--small">
                  Login
                </Link>
                <Link to="/register" className="btn btn--primary btn--small">
                  Sign Up
                </Link>
              </>
            ))}

          {/* Always available, signed in or not: the theme is a device setting. */}
          <button
            type="button"
            className="btn btn--ghost btn--small theme-toggle"
            onClick={toggleTheme}
            aria-pressed={theme === "dark"}
            aria-label={
              theme === "dark"
                ? "Switch to light mode"
                : "Switch to dark mode"
            }
            title={
              theme === "dark"
                ? "Switch to light mode"
                : "Switch to dark mode"
            }
          >
            <span aria-hidden="true">{theme === "dark" ? "☀️" : "🌙"}</span>
            <span className="theme-toggle__label">
              {theme === "dark" ? "Light" : "Dark"}
            </span>
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
