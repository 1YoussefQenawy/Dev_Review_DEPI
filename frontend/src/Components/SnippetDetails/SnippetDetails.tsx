import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { snippetsApi } from "../../services/snippetsApi";
import { ApiError } from "../../services/api";
import ReviewPanel from "../AIReview/ReviewPanel";
import { highlightCodeLine } from "../../utils/codeHighlighter";
import type { Review, Snippet } from "../../types";

function scoreClass(score: number | null) {
  if (score === null) return "bg-secondary";
  if (score >= 80) return "bg-success";
  if (score >= 60) return "bg-warning text-dark";
  return "bg-danger";
}

export default function SnippetDetails() {
  const { id } = useParams<{ id: string }>();

  const [snippet, setSnippet] = useState<Snippet | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewLoading, setReviewLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviewError, setReviewError] = useState("");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    let pollTimer: any;

    snippetsApi
      .get(id)
      .then((data) => {
        if (!cancelled) setSnippet(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load snippet");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    let attempts = 0;
    const fetchReview = () => {
      snippetsApi
        .getReview(id)
        .then((data) => {
          if (!cancelled) {
            setReview(data);
            setReviewLoading(false);
            setReviewError("");
          }
        })
        .catch((err) => {
          if (cancelled) return;
          if (err?.message?.includes("Review not ready yet") && attempts < 150) {
            attempts++;
            pollTimer = setTimeout(fetchReview, 2500);
          } else {
            setReviewError(err instanceof ApiError ? err.message : "Review is not available");
            setReviewLoading(false);
          }
        });
    };

    fetchReview();

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
  }, [id]);

  const issueLines = useMemo(
    () => new Set(review?.styleIssues.map((i) => i.line) ?? []),
    [review]
  );

  if (loading) {
    return (
      <div className="custom-bg min-vh-100 text text-center py-5" data-bs-theme="dark">
        <div className="spinner-border" role="status" />
        <p className="mt-3 mb-0">Loading snippet...</p>
      </div>
    );
  }

  if (error || !snippet) {
    return (
      <div className="custom-bg min-vh-100 text" data-bs-theme="dark">
        <div className="container py-4">
          <div className="alert alert-danger" role="alert">
            {error || "Snippet not found"}
          </div>
          <Link to="/snippets" className="link-info">
            Back to snippets
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="custom-bg min-vh-100 text" data-bs-theme="dark">
      <div className="container py-4">
        <Link to="/snippets" className="link-info text-decoration-none">
          &larr; Back to snippets
        </Link>

        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 my-3">
          <div>
            <h1 className="fw-bold mb-1 text-break">{snippet.title}</h1>
            <small className="text-secondary">
              {snippet.language} · {new Date(snippet.createdAt).toLocaleDateString()}
            </small>
          </div>
          <span className={`badge fs-5 ${scoreClass(review?.score ?? snippet.score)}`}>
            Score: {review?.score ?? snippet.score ?? "--"}
          </span>
        </div>

        <section className="mb-4">
          <h2 className="h4 mb-3">Code</h2>
          <div className="vscode-window rounded-3 overflow-hidden shadow-lg border border-secondary border-opacity-25">
            <div className="vscode-header d-flex align-items-center justify-content-between px-3 py-2">
              <div className="d-flex align-items-center gap-2">
                <span className="vscode-dot vscode-dot-red"></span>
                <span className="vscode-dot vscode-dot-yellow"></span>
                <span className="vscode-dot vscode-dot-green"></span>
                <span className="vscode-tab ms-2">{snippet.title}</span>
              </div>
              <span className="vscode-lang-badge text-secondary small font-monospace">
                {snippet.language}
              </span>
            </div>
            <pre
              className="p-3 mb-0 vscode-code-body"
              style={{ overflowX: "auto", maxHeight: 440 }}
            >
              {snippet.code.split("\n").map((line, i) => (
                <div
                  key={i}
                  style={
                    issueLines.has(i + 1)
                      ? {
                          backgroundColor: "rgba(245, 158, 11, 0.18)",
                          borderLeft: "3px solid #F59E0B",
                        }
                      : { borderLeft: "3px solid transparent" }
                  }
                  className="vscode-code-line d-flex"
                >
                  <span className="vscode-line-num me-3 user-select-none">
                    {String(i + 1).padStart(3, " ")}
                  </span>
                  <span className="vscode-code-text">{highlightCodeLine(line)}</span>
                </div>
              ))}
            </pre>
          </div>
          {issueLines.size > 0 && (
            <small className="text-secondary">Highlighted lines have style issues.</small>
          )}
        </section>

        <section>
          <h2 className="h4 mb-3">AI Review</h2>
          {reviewLoading ? (
            <div className="text-center py-4">
              <div className="spinner-border" role="status" />
              <p className="mt-3 mb-0">Analyzing your code...</p>
            </div>
          ) : reviewError || !review ? (
            <div className="alert alert-warning" role="alert">
              {reviewError || "Review is not available yet"}
            </div>
          ) : (
            <ReviewPanel review={review} />
          )}
        </section>
      </div>
    </div>
  );
}