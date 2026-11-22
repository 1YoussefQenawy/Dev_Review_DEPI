import { Navbar as BsNavbar, Nav, Container } from "react-bootstrap";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/auth-context";

export default function Navbar() {
  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <BsNavbar expand="lg" variant="dark" className="p-4 action-button">
      <Container>
        <BsNavbar.Brand as={NavLink} to="/main_page" className="fw-bold">
          DevReview AI
        </BsNavbar.Brand>

        <BsNavbar.Toggle aria-controls="main-nav" />

        <BsNavbar.Collapse id="main-nav">
          <Nav className="ms-auto">
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
                <Nav.Link as={NavLink} to="/login">Login</Nav.Link>
                <Nav.Link as={NavLink} to="/register">Register</Nav.Link>
              </>
            )}
          </Nav>
        </BsNavbar.Collapse>
      </Container>
    </BsNavbar>
  );
}