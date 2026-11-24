import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/auth-context";
import { ApiError } from "../../services/api";

interface PasswordRule {
  label: string;
  missingText: string;
  test: (pw: string) => boolean;
}

const PASSWORD_RULES: PasswordRule[] = [
  { label: "Uppercase (A-Z)", missingText: "uppercase letter (A-Z)", test: (pw) => /[A-Z]/.test(pw) },
  { label: "Lowercase (a-z)", missingText: "lowercase letter (a-z)", test: (pw) => /[a-z]/.test(pw) },
  { label: "Number (0-9)", missingText: "number (0-9)", test: (pw) => /[0-9]/.test(pw) },
  { label: "Special char (!@#$...)", missingText: "special character (e.g. !@#$%)", test: (pw) => /[^A-Za-z0-9\s]/.test(pw) },
];

function getPasswordError(password: string): string | null {
  const missing = PASSWORD_RULES.filter((rule) => !rule.test(password)).map((r) => r.missingText);
  if (missing.length === 0) return null;
  return `Password must contain uppercase letters, lowercase letters, numbers, and special characters. Missing: ${missing.join(", ")}.`;
}

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    const passwordError = getPasswordError(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      await register(name, email, password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Network error, try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-bg custom-bg min-vh-100 text d-flex align-items-center" data-bs-theme="dark">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-6 col-lg-4">
            <div className="auth-card cards-sidebar p-4 rounded-3">
              <h1 className="fw-bold h3 text-center mb-4">Register</h1>

              {error && <div className="alert alert-danger py-2 small" role="alert">{error}</div>}

              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label htmlFor="name" className="form-label">Name</label>
                  <input
                    type="text"
                    id="name"
                    className="form-control"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label htmlFor="email" className="form-label">Email or Username</label>
                  <input
                    type="text"
                    id="email"
                    className="form-control"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label htmlFor="password" className="form-label">Password</label>
                  <input
                    type="password"
                    id="password"
                    className="form-control"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <div className="d-flex flex-wrap gap-2 mt-2">
                    {PASSWORD_RULES.map((rule) => {
                      const passed = password.length > 0 && rule.test(password);
                      return (
                        <small
                          key={rule.label}
                          className={passed ? "text-success fw-semibold" : "text-secondary"}
                          style={{ fontSize: "0.75rem" }}
                        >
                          {passed ? "✓" : "•"} {rule.label}
                        </small>
                      );
                    })}
                  </div>
                </div>

                <div className="mb-3">
                  <label htmlFor="confirmPassword" className="form-label">Confirm Password</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    className="form-control"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="action-button button_hover text-white w-100 py-2 border-0 rounded-pill"
                >
                  {loading ? "Creating..." : "Create Account"}
                </button>
              </form>

              <p className="mt-3 mb-0 text-center">
                Already have an account? <Link to="/login" className="link-info">Login</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
