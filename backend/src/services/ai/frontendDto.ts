/**
 * Optional adapter: converts the AI `Review` (schema.ts) into the shape the current React UI
 * already understands (frontend/src/types/index.ts -> `Review`).
 *
 * Member 3 can call it when answering GET /snippets/:id/review so the frontend works without
 * changes. Member 1 can instead adopt the full `Review` schema later and stop using this file.
 *
 *   const dto = toFrontendReview(review, { snippetId: String(snippet.id), code: snippet.code });
 *
 * The frontend types are copied here on purpose: the backend must not import from /frontend.
 */
import type { Finding, Review } from './schema';

export interface FrontendStyleIssue {
  line: number;
  severity: 'info' | 'warning' | 'error';
  message: string;
  suggestion?: string;
}
export interface FrontendRefactoring {
  title: string;
  description: string;
  before: string;
  after: string;
}
export interface FrontendNode {
  id: string;
  name: string;
  type: 'function' | 'class' | 'variable';
}
export interface FrontendReview {
  snippetId: string;
  score: number;
  styleIssues: FrontendStyleIssue[];
  refactoringSuggestions: FrontendRefactoring[];
  documentation: string;
  unitTests: string;
  structure: { nodes: FrontendNode[]; edges: Array<{ from: string; to: string }> };
}

export interface ToFrontendOptions {
  snippetId: string;
  /** Original source. When given, "before" in refactoring suggestions shows the real line. */
  code?: string;
  /**
   * The AI graph has a root "module" node. The current UI has no "module" type, so by default it
   * is kept as the hub (shown with the "class" colour). Use 'drop' to remove it.
   */
  moduleNode?: 'hub' | 'drop';
}

const LABEL: Record<keyof Review['categories'], string> = {
  codeStyle: 'Style',
  bestPractices: 'Best practice',
  designPatterns: 'Design',
  possibleBugs: 'Bug risk',
  securityIssues: 'Security',
  refactoring: 'Refactor',
};

function severity(s: Finding['severity']): FrontendStyleIssue['severity'] {
  if (s === 'critical' || s === 'high') return 'error';
  if (s === 'medium') return 'warning';
  return 'info';
}

export function toFrontendReview(review: Review, opts: ToFrontendOptions): FrontendReview {
  const codeLines = opts.code?.replace(/\r\n?/g, '\n').split('\n');
  const styleIssues: FrontendStyleIssue[] = [];
  const refactoringSuggestions: FrontendRefactoring[] = [];

  (Object.keys(review.categories) as Array<keyof Review['categories']>).forEach((key) => {
    for (const f of review.categories[key].findings) {
      const asRefactoring = key === 'refactoring' || f.line === null;
      if (!asRefactoring) {
        // The UI needs a line number, so only findings tied to a line go to "Style Issues".
        styleIssues.push({
          line: f.line as number,
          severity: severity(f.severity),
          message: `[${LABEL[key]}] ${f.title}: ${f.description}`,
          suggestion: f.suggestion,
        });
      } else {
        refactoringSuggestions.push({
          title: `[${LABEL[key]}] ${f.title}`,
          description: f.description,
          before: f.line !== null && codeLines ? (codeLines[f.line - 1] ?? '').trim() : '',
          after: f.suggestion,
        });
      }
    }
  });
  styleIssues.sort((a, b) => a.line - b.line);

  // Whole-file automatic fixes are also useful to show.
  const keepModule = (opts.moduleNode ?? 'hub') === 'hub';
  const nodes: FrontendNode[] = review.structure.nodes
    .filter((n) => keepModule || n.type !== 'module')
    .map((n) => ({
      id: n.id,
      name: n.label,
      type: n.type === 'function' ? 'function' : n.type === 'variable' || n.type === 'other' ? 'variable' : 'class',
    }));
  const ids = new Set(nodes.map((n) => n.id));
  const edges = review.structure.edges.filter((e) => ids.has(e.from) && ids.has(e.to)).map((e) => ({ from: e.from, to: e.to }));

  return {
    snippetId: opts.snippetId,
    score: review.overallScore,
    styleIssues,
    refactoringSuggestions,
    documentation: review.documentation,
    unitTests: review.unitTestStubs,
    structure: { nodes, edges },
  };
}
