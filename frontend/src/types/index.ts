export interface User {
  id: string;
  name: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export type SnippetLanguage = "javascript" | "typescript";
export type SnippetStatus = "pending" | "analyzed" | "failed";

export interface Snippet {
  id: string;
  title: string;
  language: SnippetLanguage;
  code: string;
  createdAt: string;
  score: number | null;
  status: SnippetStatus;
}

export interface CreateSnippetInput {
  title: string;
  language: SnippetLanguage;
  code: string;
}

export interface StyleIssue {
  line: number;
  severity: "info" | "warning" | "error";
  message: string;
  suggestion?: string;
}

export interface RefactoringSuggestion {
  title: string;
  description: string;
  before: string;
  after: string;
}

export interface CodeNode {
  id: string;
  name: string;
  type: "function" | "class" | "variable";
}

export interface CodeEdge {
  from: string;
  to: string;
}

export interface Review {
  snippetId: string;
  score: number;
  styleIssues: StyleIssue[];
  refactoringSuggestions: RefactoringSuggestion[];
  documentation: string;
  unitTests: string;
  structure: {
    nodes: CodeNode[];
    edges: CodeEdge[];
  };
}