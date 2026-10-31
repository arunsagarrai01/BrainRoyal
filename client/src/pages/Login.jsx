import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import PasswordField from "../components/PasswordField";
import CaptchaField from "../components/CaptchaField";

/** Last email used with "Remember me", prefilled on the next visit. */
const REMEMBERED_EMAIL_KEY = "brainroyale:remembered-email";

const formatCountdown = (totalSeconds) => {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const Login = () => {
  const [form, setForm] = useState({ email: "", password: "" });
  const [remember, setRemember] = useState(false);
  const [captcha, setCaptcha] = useState(null);
  const [captchaAnswer, setCaptchaAnswer] = useState("");
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [error, setError] = useState("");
  const [lockSeconds, setLockSeconds] = useState(0);
  const [busy, setBusy] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();

  const locked = lockSeconds > 0;

  const handleChange = (event) =>
    setForm((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));

  /** Fetches a fresh challenge; old ones are single-use so this is always needed. */
  const loadCaptcha = useCallback(async () => {
    setCaptchaLoading(true);
    try {
      const { data } = await api.get("/auth/captcha");
      setCaptcha(data);
      setCaptchaAnswer("");
    } catch {
      setCaptcha(null);
      setError(
        "Could not load the security check. Is the API running on the configured port?"
      );
    } finally {
      setCaptchaLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCaptcha();

    const rememberedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY);
    if (rememberedEmail) {
      setForm((previous) => ({ ...previous, email: rememberedEmail }));
      setRemember(true);
    }
  }, [loadCaptcha]);

  // Live countdown while the account is locked out.
  useEffect(() => {
    if (!locked) return undefined;

    const interval = setInterval(() => {
      setLockSeconds((seconds) => (seconds <= 1 ? 0 : seconds - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [locked]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (locked || busy) return;

    if (!captchaAnswer.trim()) {
      setError("Please answer the security check.");
      return;
    }

    setError("");
    setBusy(true);

    try {
      const { data } = await api.post("/auth/login", {
        email: form.email,
        password: form.password,
        remember,
        captchaId: captcha?.captchaId,
        captchaAnswer,
      });

      // "Remember me" also remembers the email address on this device.
      const email = form.email.trim().toLowerCase();
      if (remember) localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
      else localStorage.removeItem(REMEMBERED_EMAIL_KEY);

      login(data.user, data.session);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const status = err.response?.status;
      const data = err.response?.data || {};

      if (status === 429 && data.retryAfter) {
        setLockSeconds(Number(data.retryAfter));
      }

      let message = data.message || "Login failed. Please try again.";
      if (data.remainingAttempts > 0) {
        message += ` ${data.remainingAttempts} attempt${
          data.remainingAttempts === 1 ? "" : "s"
        } left before the account is locked.`;
      }
      setError(message);

      // A CAPTCHA is one-time: always fetch a new one after a failure.
      if (data.code === "CAPTCHA_INVALID" || data.code === "CAPTCHA_REQUIRED") {
        loadCaptcha();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page page--narrow auth-wrap">
      <div className="auth-card">
        <h1>Welcome back 🍌</h1>
        <p>Sign in to keep your streak going.</p>

        {error && <div className="error-banner">{error}</div>}

        {locked && (
          <div className="lock-banner" role="status">
            🔒 Too many failed attempts. You can try again in{" "}
            <strong>{formatCountdown(lockSeconds)}</strong>.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <PasswordField
            id="login-password"
            name="password"
            label="Password"
            value={form.password}
            onChange={handleChange}
            placeholder="Your password"
            autoComplete="current-password"
          />

          <div className="checkbox-row">
            <label htmlFor="remember-me">
              <input
                id="remember-me"
                type="checkbox"
                name="remember"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
              />
              <span>
                Remember me for 30 days
                <small className="muted">
                  {" "}
                  (otherwise the session ends when the browser closes)
                </small>
              </span>
            </label>
          </div>

          <CaptchaField
            question={captcha?.question}
            value={captchaAnswer}
            onChange={(event) => setCaptchaAnswer(event.target.value)}
            onRefresh={loadCaptcha}
            loading={captchaLoading}
          />

          <button
            className="btn btn--primary btn--block"
            type="submit"
            disabled={busy || locked || captchaLoading}
          >
            {busy ? "Signing in…" : locked ? "Temporarily locked" : "Login"}
          </button>
        </form>

        <p className="auth-foot">
          New here? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
