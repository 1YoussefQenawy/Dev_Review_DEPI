import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/auth-context";
import gsap from "gsap";

const CodeIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
  </svg>
);
const SearchIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);
const TrendIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);
const UploadIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);
const ClockIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  </svg>
);
const ArrowRightIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
);

const stats = [
  { label: "Total Snippets", value: "--", iconCls: "dash-stat-icon-purple", icon: <CodeIcon /> },
  { label: "Total Reviews", value: "--", iconCls: "dash-stat-icon-cyan", icon: <SearchIcon /> },
  { label: "Average Score", value: "--", iconCls: "dash-stat-icon-amber", icon: <TrendIcon /> },
];

export default function Dashboard() {
  const { user } = useAuth();
  const dashRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const ctx = gsap.context(() => {
      gsap.from(".dash-page-title", { y: 20, opacity: 0, duration: 0.6, ease: "power3.out" });
      gsap.from(".dash-welcome", { y: 15, opacity: 0, duration: 0.5, delay: 0.1, ease: "power3.out" });
      gsap.from(".dash-stat-card", {
        y: 40, opacity: 0, scale: 0.95, duration: 0.6, stagger: 0.12, delay: 0.2, ease: "back.out(1.4)",
      });
      gsap.from(".dash-section-card", {
        y: 30, opacity: 0, duration: 0.6, stagger: 0.15, delay: 0.5, ease: "power2.out",
      });
      gsap.from(".dash-cta-btn", { y: 15, opacity: 0, duration: 0.5, delay: 0.8, ease: "power3.out" });
    }, dashRef);

    return () => ctx.revert();
  }, []);

  return (
    <div className="custom-bg min-vh-100 text" ref={dashRef}>
      <div className="container py-5">
        {/* Header */}
        <div className="mb-5">
          <h1 className="dash-page-title fw-bold mb-1">Dashboard</h1>
          <p className="dash-welcome mb-0">
            {user ? `Welcome back, ${user.name}` : "Your AI code review workspace"}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="row g-4 mb-5">
          {stats.map((s, i) => (
            <div className="col-md-4" key={i}>
              <div className="dash-stat-card">
                <div className={`dash-stat-icon ${s.iconCls}`}>{s.icon}</div>
                <p className="dash-stat-label mb-1">{s.label}</p>
                <div className="dash-stat-value">{s.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Content Sections */}
        <div className="row g-4 mb-5">
          <div className="col-lg-8">
            <div className="dash-section-card h-100">
              <div className="d-flex align-items-center gap-2 mb-3">
                <ClockIcon />
                <h2 className="dash-section-title mb-0">Recent Snippets</h2>
              </div>
              <p className="dash-empty-text mb-0">No snippets yet. Upload your first code for AI review.</p>
            </div>
          </div>
          <div className="col-lg-4">
            <div className="dash-section-card h-100">
              <h2 className="dash-section-title mb-3">Quick Actions</h2>
              <div className="d-grid gap-2">
                <Link
                  to="/upload"
                  className=" text action-button button_hover text-white px-4 py-2 border-0 rounded-pill text-decoration-none d-inline-flex align-items-center justify-content-center gap-2 dash-cta-btn"
                >
                  <UploadIcon /> Upload New Code
                </Link>
                <Link
                  to="/snippets"
                  className="btn btn-outline-light rounded-pill d-inline-flex align-items-center justify-content-center gap-2 dash-cta-btn dash-outline-btn"
                >
                  View All Snippets <ArrowRightIcon />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
