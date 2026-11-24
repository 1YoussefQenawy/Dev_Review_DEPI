import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import gsap from "gsap";
import { useAuth } from "../../context/auth-context";
import { snippetsApi } from "../../services/snippetsApi";
import { ApiError } from "../../services/api";
import type { Snippet, SnippetLanguage, SnippetStatus } from "../../types";

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
const RefreshIcon = ({ spinning }: { spinning: boolean }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={spinning ? "dash-spin" : ""}
  >
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);
const ZapIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);
const TrashIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" /><path d="M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

const STATUS_BADGE: Record<SnippetStatus, string> = {
  analyzed: "bg-success",
  pending: "bg-warning text-dark",
  failed: "bg-danger",
};

function scoreBadgeClass(score: number | null): string {
  if (score === null) return "bg-secondary";
  if (score >= 80) return "bg-success";
  if (score >= 60) return "bg-warning text-dark";
  return "bg-danger";
}

type SortOrder = "newest" | "score-desc" | "score-asc";

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const dashRef = useRef<HTMLDivElement>(null);

  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // Interactive filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | SnippetStatus>("all");
  const [langFilter, setLangFilter] = useState<"all" | SnippetLanguage>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Quick inline analyzer state
  const [showQuickAnalyze, setShowQuickAnalyze] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickLang, setQuickLang] = useState<SnippetLanguage>("javascript");
  const [quickCode, setQuickCode] = useState("");
  const [quickError, setQuickError] = useState("");
  const [quickSubmitting, setQuickSubmitting] = useState(false);

  const fetchSnippets = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await snippetsApi.list();
      setSnippets(data);
      setError("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchSnippets(false);
  }, [fetchSnippets]);

  // Auto-poll every 4s while any snippet review is pending
  const hasPending = useMemo(() => snippets.some((s) => s.status === "pending"), [snippets]);
  useEffect(() => {
    if (!hasPending) return;
    const timer = setInterval(() => {
      void fetchSnippets(false);
    }, 4000);
    return () => clearInterval(timer);
  }, [hasPending, fetchSnippets]);

  // Entrance GSAP animations
  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const ctx = gsap.context(() => {
      gsap.from(".dash-page-title", { y: 20, opacity: 0, duration: 0.6, ease: "power3.out" });
      gsap.from(".dash-welcome", { y: 15, opacity: 0, duration: 0.5, delay: 0.1, ease: "power3.out" });
      gsap.from(".dash-stat-card", {
        y: 35,
        opacity: 0,
        scale: 0.96,
        duration: 0.55,
        stagger: 0.1,
        delay: 0.15,
        ease: "back.out(1.4)",
        clearProps: "transform,opacity",
      });
      gsap.from(".dash-section-card", {
        y: 25,
        opacity: 0,
        duration: 0.55,
        stagger: 0.12,
        delay: 0.35,
        ease: "power2.out",
        clearProps: "transform,opacity",
      });
    }, dashRef);

    return () => ctx.revert();
  }, []);

  // Computed metrics
  const metrics = useMemo(() => {
    const total = snippets.length;
    const analyzed = snippets.filter((s) => s.status === "analyzed");
    const pending = snippets.filter((s) => s.status === "pending");
    const failed = snippets.filter((s) => s.status === "failed");

    const scored = analyzed.filter((s) => typeof s.score === "number") as Array<Snippet & { score: number }>;
    const avgScore = scored.length
      ? Math.round(scored.reduce((acc, s) => acc + s.score, 0) / scored.length)
      : null;

    const jsCount = snippets.filter((s) => s.language === "javascript").length;
    const tsCount = snippets.filter((s) => s.language === "typescript").length;

    const highCount = scored.filter((s) => s.score >= 80).length;
    const mediumCount = scored.filter((s) => s.score >= 60 && s.score < 80).length;
    const lowCount = scored.filter((s) => s.score < 60).length;

    return {
      total,
      analyzedCount: analyzed.length,
      pendingCount: pending.length,
      failedCount: failed.length,
      avgScore,
      jsCount,
      tsCount,
      highCount,
      mediumCount,
      lowCount,
    };
  }, [snippets]);

  const filteredSnippets = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = snippets.filter((s) => {
      if (q && !s.title.toLowerCase().includes(q)) return false;
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (langFilter !== "all" && s.language !== langFilter) return false;
      return true;
    });

    const sorted = [...list];
    if (sortOrder === "score-desc") {
      sorted.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    } else if (sortOrder === "score-asc") {
      sorted.sort((a, b) => (a.score ?? 999) - (b.score ?? 999));
    } else {
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    return sorted;
  }, [snippets, search, statusFilter, langFilter, sortOrder]);

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"?`)) return;
    setDeletingId(id);
    try {
      await snippetsApi.remove(id);
      setSnippets((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete snippet");
    } finally {
      setDeletingId(null);
    }
  };

  const handleQuickAnalyze = async (e: FormEvent) => {
    e.preventDefault();
    setQuickError("");
    if (!quickTitle.trim()) {
      setQuickError("Please enter a snippet title");
      return;
    }
    if (!quickCode.trim()) {
      setQuickError("Please paste code to analyze");
      return;
    }

    setQuickSubmitting(true);
    try {
      const created = await snippetsApi.create({
        title: quickTitle.trim(),
        language: quickLang,
        code: quickCode,
      });
      setSnippets((prev) => [created, ...prev]);
      setQuickTitle("");
      setQuickCode("");
      setShowQuickAnalyze(false);
      setStatusFilter("all");
      setLangFilter("all");
    } catch (err) {
      setQuickError(err instanceof ApiError ? err.message : "Failed to submit code");
    } finally {
      setQuickSubmitting(false);
    }
  };

  const jsPercent = metrics.total > 0 ? Math.round((metrics.jsCount / metrics.total) * 100) : 0;
  const tsPercent = metrics.total > 0 ? 100 - jsPercent : 0;

  return (
    <div className="custom-bg min-vh-100 text" ref={dashRef} data-bs-theme="dark">
      <div className="container py-5">
        {/* Header */}
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-3 mb-5">
          <div>
            <h1 className="dash-page-title fw-bold mb-1">Dashboard</h1>
            <p className="dash-welcome mb-0">
              {user ? `Welcome back, ${user.name}` : "Your AI code review workspace"}
              {hasPending && (
                <span className="badge bg-warning text-dark ms-2 align-middle">
                  <span className="spinner-border spinner-border-sm me-1" style={{ width: "0.7rem", height: "0.7rem" }} />
                  AI analyzing...
                </span>
              )}
            </p>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-sm dash-outline-btn rounded-pill px-3 py-2 d-inline-flex align-items-center gap-2"
              onClick={() => void fetchSnippets(true)}
              disabled={refreshing}
              title="Refresh live stats"
            >
              <RefreshIcon spinning={refreshing} />
              <span>{refreshing ? "Refreshing..." : "Refresh"}</span>
            </button>
            <button
              type="button"
              className="action-button button_hover text-white px-3 py-2 border-0 rounded-pill d-inline-flex align-items-center gap-2"
              onClick={() => setShowQuickAnalyze((v) => !v)}
            >
              <ZapIcon />
              <span>{showQuickAnalyze ? "Close Quick Analyze" : "Quick Analyze"}</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger py-2 mb-4 d-flex justify-content-between align-items-center" role="alert">
            <span>{error}</span>
            <button type="button" className="btn-close btn-sm" aria-label="Close" onClick={() => setError("")} />
          </div>
        )}

        {/* Quick Inline Analyzer Drawer */}
        {showQuickAnalyze && (
          <div className="dash-section-card mb-5 dash-quick-drawer">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="dash-section-title mb-0 d-flex align-items-center gap-2">
                <ZapIcon /> Quick Paste &amp; AI Review
              </h2>
              <small className="text-secondary">Analyze directly without leaving the dashboard</small>
            </div>
            {quickError && (
              <div className="alert alert-danger py-2" role="alert">
                {quickError}
              </div>
            )}
            <form onSubmit={handleQuickAnalyze}>
              <div className="row g-3 mb-3">
                <div className="col-md-8">
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Snippet title (e.g. authMiddleware.ts)"
                    value={quickTitle}
                    onChange={(e) => setQuickTitle(e.target.value)}
                  />
                </div>
                <div className="col-md-4">
                  <select
                    className="form-select"
                    value={quickLang}
                    onChange={(e) => setQuickLang(e.target.value as SnippetLanguage)}
                  >
                    <option value="javascript">JavaScript</option>
                    <option value="typescript">TypeScript</option>
                  </select>
                </div>
              </div>
              <div className="mb-3">
                <textarea
                  className="form-control font-monospace code-editor-textarea"
                  rows={6}
                  spellCheck={false}
                  placeholder="Paste your JS/TS code here for instant AI analysis..."
                  value={quickCode}
                  onChange={(e) => setQuickCode(e.target.value)}
                />
              </div>
              <div className="d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-sm dash-outline-btn rounded-pill px-3"
                  onClick={() => setShowQuickAnalyze(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={quickSubmitting}
                  className="action-button button_hover text-white px-4 py-2 border-0 rounded-pill"
                >
                  {quickSubmitting ? "Submitting..." : "Run AI Review"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Interactive Stats Grid (Click cards to filter) */}
        <div className="row g-4 mb-5">
          <div className="col-md-4">
            <button
              type="button"
              onClick={() => {
                setStatusFilter("all");
                setLangFilter("all");
                setSortOrder("newest");
              }}
              className={`dash-stat-card dash-stat-interactive w-100 text-start ${
                statusFilter === "all" && langFilter === "all" ? "dash-stat-active" : ""
              }`}
            >
              <div className="d-flex justify-content-between align-items-start">
                <div className="dash-stat-icon dash-stat-icon-purple">
                  <CodeIcon />
                </div>
                <span className="dash-stat-hint">Click to show all</span>
              </div>
              <p className="dash-stat-label mb-1">Total Snippets</p>
              <div className="dash-stat-value">{loading ? "..." : metrics.total}</div>
            </button>
          </div>

          <div className="col-md-4">
            <button
              type="button"
              onClick={() => setStatusFilter((prev) => (prev === "analyzed" ? "all" : "analyzed"))}
              className={`dash-stat-card dash-stat-interactive w-100 text-start ${
                statusFilter === "analyzed" ? "dash-stat-active" : ""
              }`}
            >
              <div className="d-flex justify-content-between align-items-start">
                <div className="dash-stat-icon dash-stat-icon-cyan">
                  <SearchIcon />
                </div>
                <span className="dash-stat-hint">
                  {metrics.pendingCount > 0 ? `${metrics.pendingCount} pending` : "Click to filter"}
                </span>
              </div>
              <p className="dash-stat-label mb-1">Analyzed Reviews</p>
              <div className="dash-stat-value">{loading ? "..." : metrics.analyzedCount}</div>
            </button>
          </div>

          <div className="col-md-4">
            <button
              type="button"
              onClick={() => {
                setStatusFilter("analyzed");
                setSortOrder((prev) => (prev === "score-desc" ? "score-asc" : "score-desc"));
              }}
              className={`dash-stat-card dash-stat-interactive w-100 text-start ${
                sortOrder !== "newest" ? "dash-stat-active" : ""
              }`}
            >
              <div className="d-flex justify-content-between align-items-start">
                <div className="dash-stat-icon dash-stat-icon-amber">
                  <TrendIcon />
                </div>
                <span className="dash-stat-hint">
                  {sortOrder === "score-desc" ? "Sorted: High → Low" : "Click to sort by score"}
                </span>
              </div>
              <p className="dash-stat-label mb-1">Average Score</p>
              <div className="d-flex align-items-baseline gap-2">
                <div className="dash-stat-value">
                  {loading ? "..." : metrics.avgScore !== null ? `${metrics.avgScore}` : "--"}
                </div>
                {metrics.avgScore !== null && <span className="text-secondary small">/ 100</span>}
              </div>
              {metrics.avgScore !== null && (
                <div className="dash-progress-track mt-2">
                  <div
                    className="dash-progress-fill"
                    style={{
                      width: `${metrics.avgScore}%`,
                      backgroundColor:
                        metrics.avgScore >= 80
                          ? "#10B981"
                          : metrics.avgScore >= 60
                          ? "#F59E0B"
                          : "#EF4444",
                    }}
                  />
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="row g-4 mb-5">
          {/* Left Column: Interactive Recent Snippets */}
          <div className="col-lg-8">
            <div className="dash-section-card h-100 d-flex flex-column">
              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
                <div className="d-flex align-items-center gap-2">
                  <ClockIcon />
                  <h2 className="dash-section-title mb-0">Recent Snippets</h2>
                  <span className="badge bg-secondary bg-opacity-25 text-secondary">
                    {filteredSnippets.length}
                  </span>
                </div>

                {/* Sort Select */}
                <select
                  className="form-select form-select-sm w-auto"
                  aria-label="Sort snippets"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                >
                  <option value="newest">Newest First</option>
                  <option value="score-desc">Highest Score</option>
                  <option value="score-asc">Lowest Score</option>
                </select>
              </div>

              {/* Search & Filter Toolbar */}
              <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
                <input
                  type="search"
                  className="form-control form-control-sm flex-grow-1"
                  style={{ minWidth: "180px" }}
                  placeholder="Search snippets by title..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div className="d-flex flex-wrap gap-1">
                  {(["all", "analyzed", "pending", "failed"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={`dash-filter-pill ${statusFilter === st ? "active" : ""}`}
                    >
                      {st === "all" ? "All" : st.charAt(0).toUpperCase() + st.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Snippets List */}
              {loading ? (
                <div className="text-center py-5 my-auto">
                  <div className="spinner-border" role="status" />
                  <p className="dash-empty-text mt-3 mb-0">Loading your snippets...</p>
                </div>
              ) : filteredSnippets.length === 0 ? (
                <div className="text-center py-4 my-auto">
                  <p className="dash-empty-text mb-3">
                    {snippets.length === 0
                      ? "No snippets yet. Upload your first code for AI review."
                      : "No snippets match your current filter."}
                  </p>
                  {snippets.length === 0 ? (
                    <button
                      type="button"
                      className="action-button button_hover text-white px-4 py-2 border-0 rounded-pill"
                      onClick={() => setShowQuickAnalyze(true)}
                    >
                      Paste Your First Snippet
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sm dash-outline-btn rounded-pill px-3"
                      onClick={() => {
                        setSearch("");
                        setStatusFilter("all");
                        setLangFilter("all");
                      }}
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              ) : (
                <div className="d-flex flex-column gap-2">
                  {filteredSnippets.slice(0, 6).map((s) => (
                    <div
                      key={s.id}
                      className="dash-snippet-row d-flex justify-content-between align-items-center flex-wrap gap-2"
                      onClick={() => navigate(`/snippets/${s.id}`)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigate(`/snippets/${s.id}`);
                        }
                      }}
                    >
                      <div className="d-flex flex-column min-w-0">
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                          <span className="fw-semibold text-truncate dash-snippet-title">
                            {s.title}
                          </span>
                          <span className="badge dash-lang-pill">
                            {s.language === "typescript" ? "TS" : "JS"}
                          </span>
                          <span className={`badge ${STATUS_BADGE[s.status]}`}>
                            {s.status === "pending" && (
                              <span
                                className="spinner-border spinner-border-sm me-1"
                                style={{ width: "0.65rem", height: "0.65rem" }}
                              />
                            )}
                            {s.status}
                          </span>
                        </div>
                        <small className="text-secondary mt-1">
                          {new Date(s.createdAt).toLocaleString()}
                        </small>
                      </div>

                      <div
                        className="d-flex align-items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className={`badge fs-6 ${scoreBadgeClass(s.score)}`}>
                          {s.score !== null ? `${s.score}/100` : "--"}
                        </span>
                        <Link
                          to={`/snippets/${s.id}`}
                          className="btn btn-sm btn-outline-info rounded-pill px-3"
                        >
                          Review
                        </Link>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger rounded-circle d-inline-flex align-items-center justify-content-center"
                          style={{ width: "30px", height: "30px" }}
                          title="Delete snippet"
                          disabled={deletingId === s.id}
                          onClick={() => void handleDelete(s.id, s.title)}
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>
                  ))}
                  {filteredSnippets.length > 6 && (
                    <div className="text-center pt-2">
                      <Link to="/snippets" className="link-info text-decoration-none small fw-semibold">
                        View all {filteredSnippets.length} snippets &rarr;
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Quick Actions + Interactive Insights */}
          <div className="col-lg-4 d-flex flex-column gap-4">
            <div className="dash-section-card">
              <h2 className="dash-section-title mb-3">Quick Actions</h2>
              <div className="d-grid gap-2">
                <Link
                  to="/upload"
                  className="text action-button button_hover text-white px-4 py-2 border-0 rounded-pill text-decoration-none d-inline-flex align-items-center justify-content-center gap-2 dash-cta-btn"
                >
                  <UploadIcon /> Upload File / Full Editor
                </Link>
                <Link
                  to="/snippets"
                  className="btn btn-outline-light rounded-pill d-inline-flex align-items-center justify-content-center gap-2 dash-cta-btn dash-outline-btn"
                >
                  View All Snippets <ArrowRightIcon />
                </Link>
              </div>
            </div>

            {/* Interactive Insights Card */}
            <div className="dash-section-card flex-grow-1">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h2 className="dash-section-title mb-0">Workspace Insights</h2>
                {langFilter !== "all" && (
                  <button
                    type="button"
                    className="btn btn-link btn-sm p-0 text-decoration-none link-info"
                    onClick={() => setLangFilter("all")}
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* Language Distribution (Clickable) */}
              <div className="mb-4">
                <div className="d-flex justify-content-between small mb-2">
                  <span className="text-secondary">Languages (click to filter)</span>
                  <span className="text-secondary">
                    {metrics.jsCount} JS · {metrics.tsCount} TS
                  </span>
                </div>

                <div className="d-flex flex-column gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setLangFilter((prev) => (prev === "javascript" ? "all" : "javascript"))
                    }
                    className={`dash-lang-bar-btn ${langFilter === "javascript" ? "active" : ""}`}
                  >
                    <div className="d-flex justify-content-between small mb-1">
                      <span className="fw-semibold">JavaScript</span>
                      <span>{jsPercent}%</span>
                    </div>
                    <div className="dash-progress-track">
                      <div
                        className="dash-progress-fill"
                        style={{ width: `${jsPercent}%`, backgroundColor: "#F59E0B" }}
                      />
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setLangFilter((prev) => (prev === "typescript" ? "all" : "typescript"))
                    }
                    className={`dash-lang-bar-btn ${langFilter === "typescript" ? "active" : ""}`}
                  >
                    <div className="d-flex justify-content-between small mb-1">
                      <span className="fw-semibold">TypeScript</span>
                      <span>{tsPercent}%</span>
                    </div>
                    <div className="dash-progress-track">
                      <div
                        className="dash-progress-fill"
                        style={{ width: `${tsPercent}%`, backgroundColor: "#3B82F6" }}
                      />
                    </div>
                  </button>
                </div>
              </div>

              {/* Quality Breakdown */}
              <div>
                <div className="small text-secondary mb-2">Review Quality Breakdown</div>
                <div className="d-flex justify-content-between gap-2 text-center">
                  <div className="dash-mini-metric flex-fill">
                    <div className="fw-bold text-success fs-5">{metrics.highCount}</div>
                    <small className="text-secondary">80+</small>
                  </div>
                  <div className="dash-mini-metric flex-fill">
                    <div className="fw-bold text-warning fs-5">{metrics.mediumCount}</div>
                    <small className="text-secondary">60–79</small>
                  </div>
                  <div className="dash-mini-metric flex-fill">
                    <div className="fw-bold text-danger fs-5">{metrics.lowCount}</div>
                    <small className="text-secondary">&lt; 60</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
