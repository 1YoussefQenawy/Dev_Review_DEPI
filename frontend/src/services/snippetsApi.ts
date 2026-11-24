import { ApiError, request } from "./api";
import type { CreateSnippetInput, Review, Snippet, StyleIssue } from "../types";

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";
const SNIPPETS_KEY = "mock_snippets";

const delay = (ms = 500) => new Promise((resolve) => setTimeout(resolve, ms));

function loadMock(): Snippet[] {
  try {
    return JSON.parse(localStorage.getItem(SNIPPETS_KEY) ?? "[]") as Snippet[];
  } catch {
    return [];
  }
}

function saveMock(list: Snippet[]) {
  localStorage.setItem(SNIPPETS_KEY, JSON.stringify(list));
}

function buildMockReview(s: Snippet): Review {
  const matches = [
    ...s.code.matchAll(/function\s+(\w+)|(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\(/g),
  ];
  const names = [...new Set(matches.map((m) => m[1] ?? m[2]))].slice(0, 8);

  const nodes = (names.length ? names : ["main"]).map((name, i) => ({
    id: String(i),
    name,
    type: "function" as const,
  }));
  const edges = nodes.slice(1).map((n) => ({ from: nodes[0].id, to: n.id }));

  const styleIssues: StyleIssue[] = [];
  s.code.split("\n").forEach((line, i) => {
    if (/\bvar\s/.test(line)) {
      styleIssues.push({
        line: i + 1,
        severity: "warning",
        message: "Avoid var, use const or let",
        suggestion: line.replace(/\bvar\b/, "const"),
      });
    }
    if (/console\.log/.test(line)) {
      styleIssues.push({
        line: i + 1,
        severity: "info",
        message: "Remove console.log before production",
      });
    }
    if (/[^=!]==[^=]/.test(line)) {
      styleIssues.push({
        line: i + 1,
        severity: "warning",
        message: "Use === instead of ==",
        suggestion: line.replace(/([^=!])==([^=])/, "$1===$2"),
      });
    }
  });

  const docList = names.length
    ? names.map((n) => "- `" + n + "`: describe what this function does.").join("\n")
    : "No functions detected.";

  const unitTests = names.length
    ? names
        .map(
          (n) =>
            'describe("' + n + '", () => {\n  it("works as expected", () => {\n    // TODO: arrange, act, assert\n  });\n});'
        )
        .join("\n\n")
    : "// No functions detected";

  return {
    snippetId: s.id,
    score: s.score ?? 70,
    styleIssues,
    refactoringSuggestions: [
      {
        title: "Add input validation",
        description: "Validate arguments at the start of the function to fail early.",
        before: "function f(x) {\n  return x.y;\n}",
        after: 'function f(x) {\n  if (!x) throw new Error("x is required");\n  return x.y;\n}',
      },
    ],
    documentation: "# " + s.title + "\n\n## Functions\n" + docList,
    unitTests,
    structure: { nodes, edges },
  };
}

export const snippetsApi = {
  async list(): Promise<Snippet[]> {
    if (!USE_MOCK) return request<Snippet[]>("/snippets");
    await delay();
    return loadMock().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async get(id: string): Promise<Snippet> {
    if (!USE_MOCK) return request<Snippet>(`/snippets/${id}`);
    await delay(300);
    const found = loadMock().find((s) => s.id === id);
    if (!found) throw new ApiError(404, "Snippet not found");
    return found;
  },

  async create(input: CreateSnippetInput): Promise<Snippet> {
    if (!USE_MOCK) {
      return request<Snippet>("/snippets", {
        method: "POST",
        body: JSON.stringify(input),
      });
    }
    await delay(800);
    const snippet: Snippet = {
      ...input,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      score: 60 + (input.code.length % 36),
      status: "analyzed",
    };
    saveMock([...loadMock(), snippet]);
    return snippet;
  },

  async remove(id: string): Promise<void> {
    if (!USE_MOCK) return request<void>(`/snippets/${id}`, { method: "DELETE" });
    await delay(300);
    saveMock(loadMock().filter((s) => s.id !== id));
  },

  async getReview(id: string): Promise<Review> {
    if (!USE_MOCK) return request<Review>(`/snippets/${id}/review`);
    await delay(600);
    const found = loadMock().find((s) => s.id === id);
    if (!found) throw new ApiError(404, "Snippet not found");
    return buildMockReview(found);
  },
};