import { Link } from "react-router-dom";

export default function Login() {
  return (
    <div className="auth-bg custom-bg min-vh-100 text d-flex align-items-center" data-bs-theme="dark">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-6 col-lg-4">
            <div className="auth-card cards-sidebar p-4 rounded-3 ">
              <h1 className="fw-bold h3 text-center mb-4">Login</h1>

              <form>
                <div className="mb-3">
                  <label htmlFor="email" className="form-label">Email</label>
                  <input type="email" id="email" className="form-control" />
                </div>

                <div className="mb-3">
                  <label htmlFor="password" className="form-label">Password</label>
                  <input type="password" id="password" className="form-control" />
                </div>

                <button
                  type="submit"
                  className="action-button button_hover text-white w-100 py-2 border-0 rounded-pill"
                >
                  Login
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