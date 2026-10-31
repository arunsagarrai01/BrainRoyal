import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import PasswordField from "../components/PasswordField";

const PASSWORD_HINT =
  "At least 8 characters, including a letter and a number.";

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const relativeTime = (value) => {
  if (!value) return "a while ago";
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diffMs / 60000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

/** Turns a user-agent string into something a human can scan. */
const describeDevice = (userAgent = "") => {
  const ua = userAgent.toLowerCase();

  const browser = ua.includes("edg/")
    ? "Edge"
    : ua.includes("firefox")
    ? "Firefox"
    : ua.includes("chrome") && !ua.includes("chromium")
    ? "Chrome"
    : ua.includes("safari")
    ? "Safari"
    : "Browser";

  const os = ua.includes("windows")
    ? "Windows"
    : ua.includes("android")
    ? "Android"
    : ua.includes("iphone") || ua.includes("ipad")
    ? "iOS"
    : ua.includes("mac os")
    ? "macOS"
    : ua.includes("linux")
    ? "Linux"
    : "Unknown OS";

  return `${browser} on ${os}`;
};

const Profile = () => {
  const { user, refresh, logout } = useAuth();
  const navigate = useNavigate();

  const [profileForm, setProfileForm] = useState({
    username: user?.username || "",
    email: user?.email || "",
  });
  const [profileStatus, setProfileStatus] = useState({ type: "", text: "" });
  const [profileBusy, setProfileBusy] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordStatus, setPasswordStatus] = useState({ type: "", text: "" });
  const [passwordBusy, setPasswordBusy] = useState(false);

  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionBusyId, setSessionBusyId] = useState(null);

  const loadSessions = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/sessions");
      setSessions(data.sessions || []);
    } catch {
      setSessions([]);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Keep the form in sync after refresh() returns newer data.
  useEffect(() => {
    if (user) {
      setProfileForm({ username: user.username, email: user.email });
    }
  }, [user]);

  const handleProfileChange = (event) =>
    setProfileForm((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setProfileStatus({ type: "", text: "" });
    setProfileBusy(true);

    try {
      const { data } = await api.patch("/auth/me", profileForm);
      await refresh(); // update the navbar and the profile card
      setProfileStatus({
        type: "ok",
        text: data.message || "Profile updated",
      });
    } catch (err) {
      setProfileStatus({
        type: "bad",
        text: err.response?.data?.message || "Could not update your profile",
      });
    } finally {
      setProfileBusy(false);
    }
  };

  const handlePasswordChange = (event) =>
    setPasswordForm((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setPasswordStatus({ type: "", text: "" });

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordStatus({ type: "bad", text: "The new passwords do not match." });
      return;
    }

    setPasswordBusy(true);
    try {
      const { data } = await api.post("/auth/change-password", passwordForm);
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setPasswordStatus({
        type: "ok",
        text:
          data.message +
          (data.signedOutDevices
            ? ` (${data.signedOutDevices} other device${
                data.signedOutDevices === 1 ? "" : "s"
              } signed out)`
            : ""),
      });
      loadSessions();
    } catch (err) {
      setPasswordStatus({
        type: "bad",
        text: err.response?.data?.message || "Could not change your password",
      });
    } finally {
      setPasswordBusy(false);
    }
  };

  const revokeSession = async (session) => {
    setSessionBusyId(session.id);
    try {
      await api.delete(`/auth/sessions/${session.id}`);

      if (session.current) {
        // This was the device we are on: go back to the login page.
        navigate("/login", { replace: true });
        return;
      }

      await loadSessions();
    } catch (err) {
      setProfileStatus({
        type: "bad",
        text: err.response?.data?.message || "Could not sign out that device",
      });
    } finally {
      setSessionBusyId(null);
    }
  };

  const signOutEverywhere = async () => {
    try {
      await api.post("/auth/logout-all");
    } catch {
      // Even if the request fails, sending the user to login is safer.
    }
    await logout();
    navigate("/login", { replace: true });
  };

  if (!user) return null;

  return (
    <div className="page">
      <div className="game-head">
        <div>
          <h1 style={{ margin: 0 }}>Your profile</h1>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            Account details, password and active sessions.
          </p>
        </div>
        <button className="btn btn--ghost btn--small" onClick={signOutEverywhere}>
          Sign out everywhere
        </button>
      </div>

      <section className="card profile-card">
        <div className="profile-identity">
          <span className="profile-avatar" aria-hidden="true">
            {user.username?.charAt(0).toUpperCase()}
          </span>
          <div>
            <h2>{user.username}</h2>
            <p className="muted">{user.email}</p>
            <p className="badge-row">
              <span className="badge">{user.role || "player"}</span>
              <span className="badge badge--soft">
                Member since {formatDate(user.created_at)}
              </span>
            </p>
          </div>
        </div>

        <div className="profile-stats">
          <div className="mini-stat">
            <span className="stat__label">Best score</span>
            <strong>{Number(user.best_score) || 0}</strong>
          </div>
          <div className="mini-stat">
            <span className="stat__label">Games played</span>
            <strong>{Number(user.games_played) || 0}</strong>
          </div>
          <div className="mini-stat">
            <span className="stat__label">Last login</span>
            <strong>{relativeTime(user.last_login_at)}</strong>
          </div>
        </div>
      </section>

      <div className="grid grid--two">
        <section className="card">
          <h2 className="card__title">Account details</h2>
          <p className="muted">Used to sign in and shown on the leaderboard.</p>

          {profileStatus.text && (
            <div
              className={
                profileStatus.type === "ok" ? "success-banner" : "error-banner"
              }
            >
              {profileStatus.text}
            </div>
          )}

          <form onSubmit={handleProfileSubmit}>
            <div className="field">
              <label htmlFor="profile-username">Username</label>
              <input
                id="profile-username"
                name="username"
                value={profileForm.username}
                onChange={handleProfileChange}
                minLength={3}
                maxLength={30}
                autoComplete="username"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="profile-email">Email</label>
              <input
                id="profile-email"
                name="email"
                type="email"
                value={profileForm.email}
                onChange={handleProfileChange}
                autoComplete="email"
                required
              />
            </div>

            <button
              className="btn btn--primary"
              type="submit"
              disabled={profileBusy}
            >
              {profileBusy ? "Saving…" : "Save changes"}
            </button>
          </form>
        </section>

        <section className="card">
          <h2 className="card__title">Change password</h2>
          <p className="muted">
            Changing your password signs out every other device.
          </p>

          {passwordStatus.text && (
            <div
              className={
                passwordStatus.type === "ok" ? "success-banner" : "error-banner"
              }
            >
              {passwordStatus.text}
            </div>
          )}

          <form onSubmit={handlePasswordSubmit}>
            <PasswordField
              id="current-password"
              name="currentPassword"
              label="Current password"
              value={passwordForm.currentPassword}
              onChange={handlePasswordChange}
              autoComplete="current-password"
            />

            <PasswordField
              id="new-password"
              name="newPassword"
              label="New password"
              value={passwordForm.newPassword}
              onChange={handlePasswordChange}
              autoComplete="new-password"
              minLength={8}
              hint={PASSWORD_HINT}
            />

            <PasswordField
              id="confirm-new-password"
              name="confirmPassword"
              label="Confirm new password"
              value={passwordForm.confirmPassword}
              onChange={handlePasswordChange}
              autoComplete="new-password"
              minLength={8}
            />

            <button
              className="btn btn--dark"
              type="submit"
              disabled={passwordBusy}
            >
              {passwordBusy ? "Updating…" : "Update password"}
            </button>
          </form>
        </section>
      </div>

      <section className="card">
        <div className="card__head">
          <div>
            <h2 className="card__title">Active sessions</h2>
            <p className="muted">
              Every browser or device currently signed in to your account.
            </p>
          </div>
          <button
            className="btn btn--ghost btn--small"
            onClick={loadSessions}
            disabled={sessionsLoading}
          >
            ↻ Refresh
          </button>
        </div>

        {sessionsLoading && <p className="muted">Loading sessions…</p>}

        {!sessionsLoading && sessions.length === 0 && (
          <p className="muted">No active sessions.</p>
        )}

        <div className="session-list">
          {sessions.map((session) => (
            <div className="session-row" key={session.id}>
              <span className="session-icon" aria-hidden="true">
                💻
              </span>

              <div className="session-info">
                <strong>
                  {describeDevice(session.userAgent)}
                  {session.current && (
                    <span className="badge badge--current">This device</span>
                  )}
                  {session.remember && (
                    <span className="badge badge--soft">Remembered</span>
                  )}
                </strong>
                <span className="muted small">
                  IP {session.ip} · last active {relativeTime(session.lastSeenAt)} ·
                  started {formatDate(session.createdAt)}
                </span>
              </div>

              <button
                className="btn btn--ghost btn--small"
                onClick={() => revokeSession(session)}
                disabled={sessionBusyId === session.id}
              >
                {sessionBusyId === session.id ? "Signing out…" : "Sign out"}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Profile;
