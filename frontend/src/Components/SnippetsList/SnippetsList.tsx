import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { snippetsApi } from "../../services/snippetsApi";
import { ApiError } from "../../services/api";
import type { Snippet, SnippetStatus } from "../../types";

const BADGE: Record<SnippetStatus, string> = {
  analyzed: "bg-success",
  pending: "bg-warning text-dark",
  failed: "bg-danger",
};

export default function SnippetsList() {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | SnippetStatus>("all");

  useEffect(() => {
    let cancelled = false;
    snippetsApi
      .list()
      .then((data) => {
        if (!cancelled) setSnippets(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load snippets");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(
    () =>
      snippets.filter(
        (s) =>
          s.title.toLowerCase().includes(search.toLowerCase()) &&
          (status === "all" || s.status === status)
      ),
    [snippets, search, status]
  );

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this snippet?")) return;
    try {
      await snippetsApi.remove(id);
      setSnippets((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete snippet");
    }
  };

  return (
    <div className="custom-bg min-vh-100 text" data-bs-theme="dark">
      <div className="container py-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1 className="fw-bold mb-0">My Snippets</h1>
          <Link
            to="/upload"
            className="action-button button_hover text-white px-4 py-2 rounded-pill text-decoration-none"
          >
            Upload New Code
          </Link>
        </div>

        {error && (
          <div className="alert alert-danger py-2" role="alert">
            {error}
          </div>
        )}

        <div className="row g-3 mb-4">
          <div className="col-md-8">
            <input
              type="search"
              className="form-control"
              placeholder="Search by title..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="col-md-4">
            <select
              className="form-select"
              value={status}
              onChange={(e) => setStatus(e.target.value as "all" | SnippetStatus)}
            >
              <option value="all">All statuses</option>
              <option value="analyzed">Analyzed</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border" role="status" />
            <p className="mt-3 mb-0">Loading snippets...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="cards-sidebar p-4 rounded-3 shadow-sm text-center">
            <p className="mb-0">
              {snippets.length === 0
                ? "No snippets yet. Upload your first one!"
                : "No snippets match your search."}
            </p>
          </div>
        ) : (
          <div className="row g-3">
            {filtered.map((s) => (
              <div className="col-md-6 col-lg-4" key={s.id}>
                <div className="cards-sidebar p-3 rounded-3 shadow-sm h-100 d-flex flex-column">
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <Link
                      to={`/snippets/${s.id}`}
                      className="fw-semibold text-decoration-none link-info text-break"
                    >
                      {s.title}
                    </Link>
                    <span className={`badge ${BADGE[s.status]} ms-2`}>{s.status}</span>
                  </div>

                  <small className="text-secondary mb-3">
                    {s.language} · {new Date(s.createdAt).toLocaleDateString()}
                  </small>

                  <div className="mt-auto d-flex justify-content-between align-items-center">
                    <span>
                      Score: <strong>{s.score ?? "--"}</strong>
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => handleDelete(s.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}