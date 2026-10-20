import { NavLink } from "react-router-dom";

export default function Navbar() {
  return (
    <nav className="navbar navbar-expand-lg navbar-light Navbar p-4">
      <NavLink to="/main_page" className="navbaar-brand fw-bold text fs-3 text-decoration-none">DevReview AI</NavLink>
    <ul className="d-flex gap-3 list-unstyled ms-auto mb-0 align-items-center">
        <li><NavLink to="/dashboard" className="text-decoration-none text fw-medium hover-effect">Dashboard</NavLink></li>
        <li><NavLink to="/login" className="text-decoration-none text fw-medium hover-effect">Login</NavLink></li>
        <li><NavLink to="/register" className="text-decoration-none text fw-medium hover-effect">Register</NavLink></li>
      </ul>
    </nav>
  );
}