import { Link } from "react-router-dom";

export default function Login() {
  return (
    <div>
      <h1>Login</h1>

      <form>
        <div>
          <label htmlFor="email">Email</label>
          <input type="email" id="email" placeholder="you@example.com" />
        </div>

        <div>
          <label htmlFor="password">Password</label>
          <input type="password" id="password" />
        </div>

        <button type="submit">Login</button>
      </form>

      <p>
        Don't have an account? <Link to="/register">Register</Link>
      </p>
    </div>
  );
}