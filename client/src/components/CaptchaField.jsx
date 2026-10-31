/**
 * The visual part of the server-issued arithmetic CAPTCHA.
 *
 * The question comes from GET /api/auth/captcha; the answer is checked on the
 * server, never in the browser. "New challenge" simply asks for another one.
 */
const CaptchaField = ({
  id = "captcha-answer",
  question,
  value,
  onChange,
  onRefresh,
  loading = false,
}) => (
  <div className="field">
    <label htmlFor={id}>Security check</label>

    <div className="captcha-box">
      <span className="captcha-question" aria-live="polite">
        {loading ? "Loading…" : question || "Unavailable"}
      </span>
      <button
        type="button"
        className="btn btn--ghost btn--small"
        onClick={onRefresh}
        disabled={loading}
        title="Get another question"
      >
        ↻ New
      </button>
    </div>

    <input
      id={id}
      name="captchaAnswer"
      type="text"
      inputMode="numeric"
      value={value}
      onChange={onChange}
      placeholder="Your answer"
      autoComplete="off"
      required
    />
  </div>
);

export default CaptchaField;
