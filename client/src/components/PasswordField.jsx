import { useState } from "react";

/**
 * Password input with a show/hide ("eye") toggle.
 *
 * The toggle only changes the input's `type`, so the value is never copied into
 * another element or the DOM as plain text. `aria-pressed`/`aria-label` keep it
 * usable with a screen reader.
 */
const PasswordField = ({
  id,
  name,
  label,
  value,
  onChange,
  placeholder = "Your password",
  autoComplete = "current-password",
  minLength,
  hint,
  required = true,
}) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>

      <div className="password-wrap">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          minLength={minLength}
          required={required}
        />

        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          title={visible ? "Hide password" : "Show password"}
        >
          {visible ? "🙈" : "👁️"}
        </button>
      </div>

      {hint && <p className="field__hint">{hint}</p>}
    </div>
  );
};

export default PasswordField;
