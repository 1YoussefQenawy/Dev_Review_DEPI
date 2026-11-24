import { useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { snippetsApi } from "../../services/snippetsApi";
import { ApiError } from "../../services/api";
import type { SnippetLanguage } from "../../types";

const MAX_SIZE = 1024 * 1024; // 1 MB
const ALLOWED = /\.(js|jsx|ts|tsx)$/i;

export default function CodeUpload() {
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [language, setLanguage] = useState<SnippetLanguage>("javascript");
  const [code, setCode] = useState("");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const readFile = async (file: File) => {
    setError("");
    if (!ALLOWED.test(file.name)) {
      setError("Only .js, .jsx, .ts and .tsx files are allowed");
      return;
    }
    if (file.size > MAX_SIZE) {
      setError("File is too large (max 1 MB)");
      return;
    }
    setCode(await file.text());
    setLanguage(/\.tsx?$/i.test(file.name) ? "typescript" : "javascript");
    setTitle((prev) => prev || file.name);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void readFile(file);
  };

  const handlePick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void readFile(file);
    e.target.value = "";
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Please enter a title");
      return;
    }
    if (!code.trim()) {
      setError("Please upload a file or paste your code");
      return;
    }

    setLoading(true);
    try {
      await snippetsApi.create({ title: title.trim(), language, code });
      navigate("/snippets");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong, try again");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="custom-bg min-vh-100 text" data-bs-theme="dark">
      <div className="container py-4">
        <h1 className="fw-bold mb-4">Upload Code</h1>

        <div className="cards-sidebar p-4 rounded-3 shadow-sm">
          {error && (
            <div className="alert alert-danger py-2" role="alert">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div
              className="rounded-3 p-4 mb-4 text-center border border-2"
              style={{
                borderStyle: "dashed",
                borderColor: dragging ? "#22D3EE" : "#8B5CF6",
                cursor: "pointer",
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInput.current?.click()}
            >
              <p className="mb-1 fw-semibold">Drag & drop your file here, or click to browse</p>
              <small className="text-secondary">.js, .jsx, .ts, .tsx (max 1 MB)</small>
              <input
                ref={fileInput}
                type="file"
                accept=".js,.jsx,.ts,.tsx"
                className="d-none"
                onChange={handlePick}
              />
            </div>

            <div className="row g-3 mb-3">
              <div className="col-md-8">
                <label htmlFor="title" className="form-label">Title</label>
                <input
                  type="text"
                  id="title"
                  className="form-control"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="col-md-4">
                <label htmlFor="language" className="form-label">Language</label>
                <select
                  id="language"
                  className="form-select"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as SnippetLanguage)}
                >
                  <option value="javascript">JavaScript</option>
                  <option value="typescript">TypeScript</option>
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label htmlFor="code" className="form-label">Code</label>
              <textarea
                id="code"
                className="form-control font-monospace"
                rows={14}
                spellCheck={false}
                placeholder="Or paste your code here..."
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="action-button button_hover text-white px-4 py-2 border-0 rounded-pill"
            >
              {loading ? "Analyzing..." : "Upload & Analyze"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}