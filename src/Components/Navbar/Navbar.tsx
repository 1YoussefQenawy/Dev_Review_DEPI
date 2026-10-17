import { NavLink } from "react-router-dom";

export default function Navbar() {
  return (
    <nav>
      <NavLink to="/dashboard">DevReview AI</NavLink>
    <ul>
        <li><NavLink to="/dashboard">Dashboard</NavLink></li>
        <li><NavLink to="/login">Login</NavLink></li>
        <li><NavLink to="/register">Register</NavLink></li>
      </ul>
    </nav>
  );
}