import { Link } from "react-router-dom";

export default function Register() {
  return (
    <div className="auth-bg custom-bg min-vh-100 text d-flex align-items-center" data-bs-theme="dark">
      <div className="container">
        <div className="row justify-content-center">
          <div className="col-md-6 col-lg-4">
            <div className="auth-card cards-sidebar p-4 rounded-3 ">
              <h1 className="fw-bold h3 text-center mb-4">Register</h1>

              <form>
                <div className="mb-3">
                  <label htmlFor="name" className="form-label">Name</label>
                  <input type="text" id="name" className="form-control" />
                </div>

                <div className="mb-3">
                  <label htmlFor="email" className="form-label">Email</label>
                  <input type="email" id="email" className="form-control" />
                </div>

                <div className="mb-3">
                  <label htmlFor="password" className="form-label">Password</label>
                  <input type="password" id="password" className="form-control" />
                </div>

                <div className="mb-3">
                  <label htmlFor="confirmPassword" className="form-label">Confirm Password</label>
                  <input type="password" id="confirmPassword" className="form-control" />
                </div>

                <button
                  type="submit"
                  className="action-button button_hover text-white w-100 py-2 border-0 rounded-pill"
                >
                  Create Account
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