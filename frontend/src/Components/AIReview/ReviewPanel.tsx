import { useState } from "react";
import CodeStructureGraph from "./CodeStructureGraph";
import type { Review, StyleIssue } from "../../types";

type TabKey = "style" | "refactor" | "docs" | "tests" | "structure";

const SEVERITY_BADGE: Record<StyleIssue["severity"], string> = {
  info: "bg-info text-dark",
  warning: "bg-warning text-dark",
  error: "bg-danger",
};

const PRE_STYLE = {
  backgroundColor: "#111318",
  overflowX: "auto" as const,
  whiteSpace: "pre-wrap" as const,
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button type="button" className="btn btn-sm btn-outline-info" onClick={handleCopy}>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export default function ReviewPanel({ review }: { review: Review }) {
  const [tab, setTab] = useState<TabKey>("style");

  const tabs: { key: TabKey; label: string }[] = [
    { key: "style", label: `Style Issues (${review.styleIssues.length})` },
    { key: "refactor", label: `Refactoring (${review.refactoringSuggestions.length})` },
    { key: "docs", label: "Documentation" },
    { key: "tests", label: "Unit Tests" },
    { key: "structure", label: "Structure" },
  ];

  return (
    <div className="cards-sidebar p-3 rounded-3 shadow-sm">
      <ul className="nav nav-tabs mb-3">
        {tabs.map((t) => (
          <li className="nav-item" key={t.key}>
            <button
              type="button"
              className={`nav-link ${tab === t.key ? "active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          </li>
        ))}
      </ul>

      <div className="review-tab" key={tab}>
        {tab === "style" &&
          (review.styleIssues.length === 0 ? (
            <p className="mb-0">No style issues found. Nice work!</p>
          ) : (
            <ul className="list-unstyled mb-0">
              {review.styleIssues.map((issue, i) => (
                <li className="mb-3" key={i}>
                  <span className={`badge ${SEVERITY_BADGE[issue.severity]} me-2`}>
                    {issue.severity}
                  </span>
                  <strong>Line {issue.line}:</strong> {issue.message}
                  {issue.suggestion && (
                    <pre className="p-2 rounded-3 text-white mt-2 mb-0" style={PRE_STYLE}>
                      {issue.suggestion}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          ))}

        {tab === "refactor" &&
          (review.refactoringSuggestions.length === 0 ? (
            <p className="mb-0">No refactoring suggestions.</p>
          ) : (
            review.refactoringSuggestions.map((r, i) => (
              <div className="mb-4" key={i}>
                <h3 className="h6 fw-bold">{r.title}</h3>
                <p>{r.description}</p>
                <div className="row g-3">
                  <div className="col-md-6">
                    <small className="text-secondary">Before</small>
                    <pre className="p-3 rounded-3 text-white mb-0" style={PRE_STYLE}>
                      {r.before}
                    </pre>
                  </div>
                  <div className="col-md-6">
                    <small className="text-secondary">After</small>
                    <pre className="p-3 rounded-3 text-white mb-0" style={PRE_STYLE}>
                      {r.after}
                    </pre>
                  </div>
                </div>
              </div>
            ))
          ))}

        {tab === "docs" && (
          <div>
            <div className="d-flex justify-content-end mb-2">
              <CopyButton text={review.documentation} />
            </div>
            <pre className="p-3 rounded-3 text-white mb-0" style={PRE_STYLE}>
              {review.documentation}
            </pre>
          </div>
        )}

        {tab === "tests" && (
          <div>
            <div className="d-flex justify-content-end mb-2">
              <CopyButton text={review.unitTests} />
            </div>
            <pre className="p-3 rounded-3 text-white mb-0" style={PRE_STYLE}>
              {review.unitTests}
            </pre>
          </div>
        )}

        {tab === "structure" && (
          <CodeStructureGraph nodes={review.structure.nodes} edges={review.structure.edges} />
        )}
      </div>
    </div>
  );
}