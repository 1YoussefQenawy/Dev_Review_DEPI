import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { snippetsApi } from "../../services/snippetsApi";
import { ApiError } from "../../services/api";
import ReviewPanel from "../AIReview/ReviewPanel";
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

    snippetsApi
      .getReview(id)
      .then((data) => {
        if (!cancelled) setReview(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setReviewError(err instanceof ApiError ? err.message : "Review is not available");
        }
      })
      .finally(() => {
        if (!cancelled) setReviewLoading(false);
      });

    return () => {
      cancelled = true;
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
          <pre
            className="p-3 rounded-3 text-white mb-0 cards-sidebar"
            style={{ overflowX: "auto", maxHeight: 420 }}
          >
            {snippet.code.split("\n").map((line, i) => (
              <div
                key={i}
                style={
                  issueLines.has(i + 1)
                    ? { backgroundColor: "rgba(245, 158, 11, 0.18)" }
                    : undefined
                }
              >
                <span className="text-secondary me-3 user-select-none">
                  {String(i + 1).padStart(3, " ")}
                </span>
                {line || " "}
              </div>
            ))}
          </pre>
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