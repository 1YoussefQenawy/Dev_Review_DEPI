import { Navbar as BsNavbar, Nav, Container } from "react-bootstrap";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/auth-context";
import { useState, useCallback } from "react";

const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
)

const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
)

export default function Navbar() {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [light, setLight] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const toggleTheme = useCallback(() => {
    setLight(v => {
      const next = !v;
      document.documentElement.classList.toggle('light-mode', next);
      return next;
    });
  }, []);

  return (
    <BsNavbar expand="lg" variant="dark" className="p-4 action-button">
      <Container>
        <BsNavbar.Brand as={NavLink} to="/main_page" className="fw-bold">
          DevReview AI
        </BsNavbar.Brand>

        <BsNavbar.Toggle aria-controls="main-nav" />

        <BsNavbar.Collapse id="main-nav">
          <Nav className="ms-auto align-items-center">
            {isAuthenticated ? (
              <>
        <>
  <Nav.Link as={NavLink} to="/dashboard">Dashboard</Nav.Link>
  <Nav.Link as={NavLink} to="/upload">Upload</Nav.Link>
  <Nav.Link as={NavLink} to="/snippets">Snippets</Nav.Link>
  <Nav.Link onClick={handleLogout}>Logout</Nav.Link>
</>
      </>
            ) : (
              <>
                <Nav.Link as={NavLink} to="/login" className="nav-auth-link">Login</Nav.Link>
                <Nav.Link as={NavLink} to="/register" className="nav-auth-link">Register</Nav.Link>
              </>
            )}
            <button
              className="theme-toggle-nav"
              onClick={toggleTheme}
              aria-label="Toggle light/dark mode"
              title={light ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {light ? <MoonIcon /> : <SunIcon />}
            </button>
          </Nav>
        </BsNavbar.Collapse>
      </Container>
    </BsNavbar>
  );
}
