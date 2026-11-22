import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/auth-context";
import { ApiError } from "../../services/api";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from =
    (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
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
              <h1 className="fw-bold h3 text-center mb-4">Login</h1>

              {error && <div className="alert alert-danger py-2" role="alert">{error}</div>}

              <form onSubmit={handleSubmit}>
                <div className="mb-3">
                  <label htmlFor="email" className="form-label">Email</label>
                  <input
                    type="email"
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
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="action-button button_hover text-white w-100 py-2 border-0 rounded-pill"
                >
                  {loading ? "Logging in..." : "Login"}
                </button>
              </form>

              <p className="mt-3 mb-0 text-center">
                Don't have an account? <Link to="/register" className="link-info">Register</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}