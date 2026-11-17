import type { AiProvider, GenerateRequest } from './provider';
import type { Review } from './schema';

type Finding = Review['categories']['codeStyle']['findings'][number];

function lineOf(code: string, re: RegExp): number | null {
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) if (re.test(lines[i])) return i + 1;
  return null;
}

function score(findings: Finding[]): number {
  const penalty = { info: 2, low: 5, medium: 12, high: 20, critical: 30 } as const;
  return Math.max(0, 100 - findings.reduce((sum, f) => sum + penalty[f.severity], 0));
}

/**
 * Free, offline provider. It makes NO network calls and uses a few simple pattern checks
 * so the demo/dev experience looks realistic. It returns a JSON *string* exactly like a real
 * model would, so the same parsing + validation code path is exercised.
 */
export class MockProvider implements AiProvider {
  readonly name = 'mock';

  async generate(req: GenerateRequest): Promise<string> {
    const { code } = req;
    const style: Finding[] = [];
    const best: Finding[] = [];
    const bugs: Finding[] = [];
    const security: Finding[] = [];

    if (/\bvar\s/.test(code))
      style.push({ title: 'Use let/const instead of var', severity: 'low', line: lineOf(code, /\bvar\s/), description: '`var` is function-scoped and easy to misuse.', suggestion: 'Replace `var` with `const` (or `let` if reassigned).' });
    if (/console\.log/.test(code))
      best.push({ title: 'Leftover console.log', severity: 'info', line: lineOf(code, /console\.log/), description: 'Debug logging should not ship to production.', suggestion: 'Remove it or use a proper logger.' });
    if (/[^=!]==[^=]/.test(code))
      bugs.push({ title: 'Loose equality (==)', severity: 'medium', line: lineOf(code, /[^=!]==[^=]/), description: '`==` performs type coercion and can hide bugs.', suggestion: 'Use strict equality `===`.' });
    if (/\beval\s*\(/.test(code))
      security.push({ title: 'Use of eval()', severity: 'critical', line: lineOf(code, /\beval\s*\(/), description: '`eval` executes arbitrary strings as code.', suggestion: 'Remove `eval`; parse data with JSON.parse or use safe logic.' });
    if (/(api[_-]?key|password|secret)\s*[:=]\s*['"][^'"]+['"]/i.test(code))
      security.push({ title: 'Hard-coded secret', severity: 'high', line: lineOf(code, /(api[_-]?key|password|secret)\s*[:=]/i), description: 'Secrets in source code leak through version control.', suggestion: 'Load secrets from environment variables.' });

    const patterns: Finding[] = [];
    const refactor: Finding[] = [];
    if (code.split('\n').length > 80)
      refactor.push({ title: 'Long file', severity: 'low', line: null, description: 'Large files are hard to maintain.', suggestion: 'Split into smaller modules.' });

    const cats = {
      codeStyle: { score: score(style), findings: style },
      bestPractices: { score: score(best), findings: best },
      designPatterns: { score: score(patterns), findings: patterns },
      possibleBugs: { score: score(bugs), findings: bugs },
      securityIssues: { score: score(security), findings: security },
      refactoring: { score: score(refactor), findings: refactor },
    };
    const all = Object.values(cats).map((c) => c.score);
    const overall = Math.round(all.reduce((a, b) => a + b, 0) / all.length);

    const nodes: Review['structure']['nodes'] = [{ id: 'module', label: 'module', type: 'module', line: null }];
    const edges: Review['structure']['edges'] = [];
    const seen = new Set<string>();
    const add = (name: string, type: 'function' | 'class') => {
      if (seen.has(name)) return;
      seen.add(name);
      nodes.push({ id: name, label: name, type, line: lineOf(code, new RegExp(`\\b${name}\\b`)) });
      edges.push({ from: 'module', to: name, relation: 'contains' });
    };
    for (const m of code.matchAll(/function\s+([A-Za-z_$][\w$]*)/g)) add(m[1], 'function');
    for (const m of code.matchAll(/(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g)) add(m[1], 'function');
    for (const m of code.matchAll(/class\s+([A-Za-z_$][\w$]*)/g)) add(m[1], 'class');

    const review: Review = {
      overallScore: overall,
      summary: `[MOCK REVIEW] Offline sample review. ${style.length + best.length + bugs.length + security.length + refactor.length} potential issue(s) detected by simple pattern checks.`,
      categories: cats,
      refactoredCode: code,
      documentation: '# Documentation (mock)\n\nThis is a sample generated without calling a real AI model.',
      unitTestStubs: "describe('module', () => {\n  it('works', () => {\n    expect(true).toBe(true);\n  });\n});",
      structure: { nodes, edges },
    };
    return JSON.stringify(review);
  }
}
