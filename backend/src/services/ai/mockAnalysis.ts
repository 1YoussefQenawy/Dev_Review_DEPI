/**
 * Offline, deterministic "pretend AI" used by MockProvider.
 *
 * It reads the code with simple text analysis (no network, no AI model) and returns a Review that
 * passes the same Zod schema as a real model reply. It is NOT a real parser: it is tuned to give
 * a realistic, varied review for typical student/demo JavaScript and TypeScript.
 */
import type { Finding, Review } from './schema';

type Severity = Finding['severity'];
type CategoryName = keyof Review['categories'];
type Language = 'javascript' | 'typescript';

const SEVERITY_ORDER: Record<Severity, number> = { critical: 5, high: 4, medium: 3, low: 2, info: 1 };
const PENALTY: Record<Severity, number> = { info: 2, low: 5, medium: 12, high: 20, critical: 30 };
const WEIGHT: Record<CategoryName, number> = {
  codeStyle: 1,
  bestPractices: 1,
  designPatterns: 0.8,
  possibleBugs: 1.4,
  securityIssues: 1.6,
  refactoring: 0.8,
};

/** Show at most this many separate findings per rule, then one "+N more" finding. */
const MAX_PER_RULE = 3;
const MAX_PER_CATEGORY = 12;
const MAX_NODES = 40;

/* -------------------------------------------------------------------------- */
/* Text helpers                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Returns text of the SAME length and line layout as `src`, but with comments blanked out
 * (and string contents too unless `keepStrings`). This stops rules from matching text that is
 * only inside a comment or a string, e.g. `// console.log(x)` or `"use var"`.
 */
export function blankNonCode(src: string, keepStrings: boolean): string {
  let out = '';
  let i = 0;
  const n = src.length;
  const blank = (ch: string) => (ch === '\n' ? '\n' : ' ');
  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') {
        out += ' ';
        i++;
      }
      continue;
    }
    if (c === '/' && d === '*') {
      out += '  ';
      i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) {
        out += blank(src[i]);
        i++;
      }
      if (i < n) {
        out += '  ';
        i += 2;
      }
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      out += c;
      i++;
      while (i < n && src[i] !== c) {
        if (src[i] === '\\' && i + 1 < n) {
          out += keepStrings ? src[i] + src[i + 1] : ' ' + blank(src[i + 1]);
          i += 2;
          continue;
        }
        if (src[i] === '\n' && c !== '`') break; // unterminated string: stop at end of line
        out += keepStrings ? src[i] : blank(src[i]);
        i++;
      }
      if (i < n && src[i] === c) {
        out += c;
        i++;
      }
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function snippet(line: string): string {
  const t = line.trim().replace(/\s+/g, ' ');
  return t.length > 70 ? t.slice(0, 67) + '...' : t;
}

function words(name: string): string {
  const spaced = name
    .replace(/^_+/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_$]+/g, ' ')
    .trim()
    .toLowerCase();
  return spaced ? spaced[0].toUpperCase() + spaced.slice(1) : name;
}

/** Index of the bracket that closes the one at `openIdx`, or -1. Works on blanked text. */
function matchBracket(text: string, openIdx: number): number {
  const open = text[openIdx];
  const close = open === '(' ? ')' : open === '{' ? '}' : ']';
  let depth = 0;
  for (let i = openIdx; i < text.length; i++) {
    if (text[i] === open) depth++;
    else if (text[i] === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function splitTopLevel(text: string, sep = ','): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of text) {
    if ('([{<'.includes(ch)) depth++;
    else if (')]}>'.includes(ch)) depth = Math.max(0, depth - 1);
    if (ch === sep && depth === 0) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts.map((p) => p.trim()).filter(Boolean);
}

/* -------------------------------------------------------------------------- */
/* Structure extraction                                                        */
/* -------------------------------------------------------------------------- */

interface Param {
  name: string;
  type?: string;
  optional: boolean;
}
interface Fn {
  id: string;
  name: string;
  owner?: string;
  params: Param[];
  isAsync: boolean;
  line: number;
  endLine: number;
  bodyStart: number;
  bodyEnd: number;
  exported: boolean;
  hasDoc: boolean;
}
interface Cls {
  name: string;
  extendsName?: string;
  line: number;
  methodCount: number;
  exported: boolean;
}

class Source {
  readonly raw: string;
  readonly code: string; // comments + strings blanked
  readonly noComment: string; // comments blanked, strings kept
  readonly rawLines: string[];
  readonly codeLines: string[];
  readonly noCommentLines: string[];
  private readonly starts: number[] = [0];

  constructor(input: string, readonly language: Language) {
    this.raw = input.replace(/\r\n?/g, '\n');
    this.code = blankNonCode(this.raw, false);
    this.noComment = blankNonCode(this.raw, true);
    this.rawLines = this.raw.split('\n');
    this.codeLines = this.code.split('\n');
    this.noCommentLines = this.noComment.split('\n');
    for (let i = 0; i < this.raw.length; i++) if (this.raw[i] === '\n') this.starts.push(i + 1);
  }

  lineOfIndex(idx: number): number {
    let lo = 0;
    let hi = this.starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.starts[mid] <= idx) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  }

  /** 1-based line numbers whose blanked-code text matches `re`. */
  hits(re: RegExp, lines: string[] = this.codeLines): number[] {
    const out: number[] = [];
    const rx = new RegExp(re.source, re.flags.replace('g', ''));
    lines.forEach((l, i) => {
      if (rx.test(l)) out.push(i + 1);
    });
    return out;
  }

  isBlank(line: number): boolean {
    return this.rawLines[line - 1].trim() === '';
  }
}

function parseParams(raw: string): Param[] {
  return splitTopLevel(raw).map((p) => {
    let text = p.replace(/^\.\.\./, '').trim();
    const eq = text.indexOf('=');
    const hasDefault = eq > 0 && !/=>/.test(text.slice(eq, eq + 2));
    if (hasDefault) text = text.slice(0, eq).trim();
    const colon = text.indexOf(':');
    let name = colon > 0 && !/^[{[]/.test(text) ? text.slice(0, colon).trim() : text;
    const type = colon > 0 && !/^[{[]/.test(text) ? text.slice(colon + 1).trim() : undefined;
    const optional = hasDefault || name.endsWith('?');
    name = name.replace(/\?$/, '');
    return { name, type, optional };
  });
}

function hasDocBefore(src: Source, line: number): boolean {
  for (let l = line - 1; l >= 1; l--) {
    const t = src.rawLines[l - 1].trim();
    if (t === '') return false;
    return t.endsWith('*/') || t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
  }
  return false;
}

function isExported(src: Source, name: string, prefix: string): boolean {
  if (/\bexport\b/.test(prefix)) return true;
  const n = escapeRe(name);
  return new RegExp(`\\bexports\\.${n}\\b|module\\.exports[^;]*\\b${n}\\b|export\\s*\\{[^}]*\\b${n}\\b`).test(src.code);
}

function extractStructure(src: Source): { fns: Fn[]; classes: Cls[] } {
  const fns: Fn[] = [];
  const classes: Cls[] = [];
  const taken = new Set<string>();
  const text = src.code;

  const push = (f: Omit<Fn, 'id' | 'line' | 'endLine' | 'hasDoc'> & { startIdx: number; id?: string }) => {
    const id = f.id ?? f.name;
    if (taken.has(id)) return;
    taken.add(id);
    const line = src.lineOfIndex(f.startIdx);
    fns.push({
      ...f,
      id,
      line,
      endLine: src.lineOfIndex(Math.max(f.bodyEnd, f.startIdx)),
      hasDoc: hasDocBefore(src, line),
    });
  };

  // 1) function declarations
  const declRe = /(^|[^\w$.])((?:export\s+(?:default\s+)?)?)(async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*(?:<[^>(]*>)?\s*\(/g;
  for (const m of text.matchAll(declRe)) {
    const parenIdx = m.index! + m[0].length - 1;
    const parenEnd = matchBracket(text, parenIdx);
    if (parenEnd < 0) continue;
    const braceIdx = text.indexOf('{', parenEnd);
    if (braceIdx < 0 || braceIdx - parenEnd > 200) continue;
    const bodyEnd = matchBracket(text, braceIdx);
    if (bodyEnd < 0) continue;
    push({
      name: m[4],
      params: parseParams(src.raw.slice(parenIdx + 1, parenEnd)),
      isAsync: !!m[3],
      bodyStart: braceIdx,
      bodyEnd,
      exported: isExported(src, m[4], m[2]),
      startIdx: m.index! + m[1].length,
    });
  }

  // 2) const x = function (...) {...}
  const exprRe = /(^|[^\w$.])((?:export\s+)?)(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(async\s+)?function\s*\*?\s*[\w$]*\s*\(/g;
  for (const m of text.matchAll(exprRe)) {
    const parenIdx = m.index! + m[0].length - 1;
    const parenEnd = matchBracket(text, parenIdx);
    const braceIdx = parenEnd < 0 ? -1 : text.indexOf('{', parenEnd);
    const bodyEnd = braceIdx < 0 ? -1 : matchBracket(text, braceIdx);
    if (bodyEnd < 0) continue;
    push({
      name: m[3],
      params: parseParams(src.raw.slice(parenIdx + 1, parenEnd)),
      isAsync: !!m[4],
      bodyStart: braceIdx,
      bodyEnd,
      exported: isExported(src, m[3], m[2]),
      startIdx: m.index! + m[1].length,
    });
  }

  // 3) arrow functions: const x = (a, b) => {...}   /   const x = a => a * 2
  const arrowRe = /(^|[^\w$.])((?:export\s+)?)(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(async\s+)?(?:(\()|([A-Za-z_$][\w$]*)\s*=>)/g;
  for (const m of text.matchAll(arrowRe)) {
    let params: Param[];
    let afterIdx: number;
    if (m[5]) {
      const parenIdx = m.index! + m[0].length - 1;
      const parenEnd = matchBracket(text, parenIdx);
      if (parenEnd < 0) continue;
      const tail = text.slice(parenEnd + 1).match(/^\s*(?::[^=>{;]+)?\s*=>/);
      if (!tail) continue; // just a parenthesised value, not an arrow function
      params = parseParams(src.raw.slice(parenIdx + 1, parenEnd));
      afterIdx = parenEnd + 1 + tail[0].length;
    } else {
      params = [{ name: m[6], optional: false }];
      afterIdx = m.index! + m[0].length;
    }
    const rest = text.slice(afterIdx);
    const ws = rest.match(/^\s*/)![0].length;
    let bodyStart = afterIdx + ws;
    let bodyEnd: number;
    if (text[bodyStart] === '{') {
      bodyEnd = matchBracket(text, bodyStart);
      if (bodyEnd < 0) continue;
    } else {
      const eol = text.indexOf('\n', bodyStart);
      bodyEnd = eol < 0 ? text.length - 1 : eol;
      bodyStart = Math.min(bodyStart, bodyEnd);
    }
    push({
      name: m[3],
      params,
      isAsync: !!m[4],
      bodyStart,
      bodyEnd,
      exported: isExported(src, m[3], m[2]),
      startIdx: m.index! + m[1].length,
    });
  }

  // 4) classes and their methods
  const classRe = /(^|[^\w$.])((?:export\s+(?:default\s+)?)?)(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)(?:\s+extends\s+([A-Za-z_$][\w$.]*))?[^{]*\{/g;
  const KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'else', 'with']);
  for (const m of text.matchAll(classRe)) {
    const braceIdx = m.index! + m[0].length - 1;
    const end = matchBracket(text, braceIdx);
    if (end < 0) continue;
    const className = m[3];
    let methodCount = 0;
    const body = text.slice(braceIdx + 1, end);
    const methodRe = /(^|\n)[ \t]*(?:(?:public|private|protected|static|async|readonly|override|get|set)\s+)*([A-Za-z_$#][\w$]*)\s*(?:<[^>(]*>)?\s*\(/g;
    for (const mm of body.matchAll(methodRe)) {
      const name = mm[2];
      if (KEYWORDS.has(name)) continue;
      const nameIdx = braceIdx + 1 + mm.index! + mm[0].length - 1;
      const before = text.slice(braceIdx + 1, braceIdx + 1 + mm.index!);
      const depth = (before.match(/\{/g)?.length ?? 0) - (before.match(/\}/g)?.length ?? 0);
      if (depth !== 0) continue; // only direct members of the class
      const parenEnd = matchBracket(text, nameIdx);
      if (parenEnd < 0) continue;
      const bIdx = text.indexOf('{', parenEnd);
      if (bIdx < 0 || bIdx - parenEnd > 200 || bIdx > end) continue;
      const bEnd = matchBracket(text, bIdx);
      if (bEnd < 0) continue;
      methodCount++;
      push({
        id: `${className}.${name}`,
        name,
        owner: className,
        params: parseParams(src.raw.slice(nameIdx + 1, parenEnd)),
        isAsync: /\basync\s+[\w$#]*\s*$/.test(text.slice(Math.max(0, nameIdx - 30), nameIdx)),
        bodyStart: bIdx,
        bodyEnd: bEnd,
        exported: /\bexport\b/.test(m[2]) || isExported(src, className, ''),
        startIdx: braceIdx + 1 + mm.index! + mm[1].length,
      });
    }
    classes.push({
      name: className,
      extendsName: m[4],
      line: src.lineOfIndex(m.index! + m[1].length),
      methodCount,
      exported: isExported(src, className, m[2]),
    });
  }

  fns.sort((a, b) => a.line - b.line);
  return { fns, classes };
}

function topLevelVariables(src: Source): Array<{ name: string; line: number; keyword: string }> {
  const out: Array<{ name: string; line: number; keyword: string }> = [];
  let depth = 0;
  src.codeLines.forEach((line, i) => {
    if (depth === 0) {
      const m = line.match(/^\s*(?:export\s+)?(const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=/);
      if (m) out.push({ name: m[2], line: i + 1, keyword: m[1] });
    }
    for (const ch of line) {
      if (ch === '{' || ch === '(' || ch === '[') depth++;
      else if (ch === '}' || ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    }
  });
  return out;
}

/* -------------------------------------------------------------------------- */
/* Findings collection                                                         */
/* -------------------------------------------------------------------------- */

interface Rule {
  title: string;
  severity: Severity;
  description: string;
  suggestion: string;
}

class Findings {
  private readonly byCategory: Record<CategoryName, Finding[]> = {
    codeStyle: [],
    bestPractices: [],
    designPatterns: [],
    possibleBugs: [],
    securityIssues: [],
    refactoring: [],
  };

  constructor(private readonly src: Source) {}

  /** One finding per hit (max MAX_PER_RULE), then a single "+N more" finding. */
  lines(cat: CategoryName, rule: Rule, hits: number[], detail?: (line: number, text: string) => string): void {
    if (hits.length === 0) return;
    const shown = hits.slice(0, MAX_PER_RULE);
    for (const line of shown) {
      const text = snippet(this.src.rawLines[line - 1] ?? '');
      this.byCategory[cat].push({
        title: rule.title,
        severity: rule.severity,
        line,
        description: `${detail ? detail(line, text) : rule.description}${text ? ` (\`${text}\`)` : ''}`,
        suggestion: rule.suggestion,
      });
    }
    const rest = hits.slice(MAX_PER_RULE);
    if (rest.length > 0) {
      const list = rest.slice(0, 12).join(', ') + (rest.length > 12 ? ', ...' : '');
      this.byCategory[cat].push({
        title: `${rule.title}: ${rest.length} more occurrence${rest.length === 1 ? '' : 's'}`,
        severity: hits.length > 5 && SEVERITY_ORDER[rule.severity] < SEVERITY_ORDER.low ? 'low' : rule.severity,
        line: null,
        description: `The same problem also appears on lines ${list} (${hits.length} total).`,
        suggestion: rule.suggestion,
      });
    }
  }

  /** A single finding about the whole file or one spot. */
  one(cat: CategoryName, rule: Rule, line: number | null, extra?: string): void {
    this.byCategory[cat].push({
      title: rule.title,
      severity: rule.severity,
      line,
      description: extra ? `${rule.description} ${extra}` : rule.description,
      suggestion: rule.suggestion,
    });
  }

  result(): Review['categories'] {
    const finish = (cat: CategoryName) => {
      const findings = [...this.byCategory[cat]]
        .sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity] || (a.line ?? 1e9) - (b.line ?? 1e9))
        .slice(0, MAX_PER_CATEGORY);
      const score = Math.max(0, 100 - findings.reduce((s, f) => s + PENALTY[f.severity], 0));
      return { score, findings };
    };
    return {
      codeStyle: finish('codeStyle'),
      bestPractices: finish('bestPractices'),
      designPatterns: finish('designPatterns'),
      possibleBugs: finish('possibleBugs'),
      securityIssues: finish('securityIssues'),
      refactoring: finish('refactoring'),
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Variable analysis (shared by findings and refactoredCode)                    */
/* -------------------------------------------------------------------------- */

/** How many times `name` is assigned (`=`, `+=`, `++` ...), counting the declaration itself. */
function assignmentCount(code: string, name: string): number {
  const n = escapeRe(name);
  const after = new RegExp(`(?<![\\w$.])${n}\\s*(?:=(?![=>])|[+\\-*/%&|^]=|\\*\\*=|<<=|>>>?=|\\+\\+|--)`, 'g');
  const before = new RegExp(`(?:\\+\\+|--)\\s*${n}(?![\\w$])`, 'g');
  return (code.match(after)?.length ?? 0) + (code.match(before)?.length ?? 0);
}

function declarationCount(code: string, name: string): number {
  return code.match(new RegExp(`\\b(?:let|var|const)\\s+${escapeRe(name)}\\b`, 'g'))?.length ?? 0;
}

/** Names declared with `let/var name = ...` that are never assigned again. */
function neverReassigned(code: string, name: string): boolean {
  return declarationCount(code, name) === 1 && assignmentCount(code, name) <= 1;
}

type LiteralKind = 'string' | 'number' | 'boolean';
function literalKind(text: string): LiteralKind | null {
  const t = text.trim().replace(/;$/, '').trim();
  if (/^(['"`])[^'"`\n]*\1$/.test(t)) return 'string';
  if (/^-?\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(t)) return 'number';
  if (/^(true|false)$/.test(t)) return 'boolean';
  return null;
}

/* -------------------------------------------------------------------------- */
/* The rules                                                                   */
/* -------------------------------------------------------------------------- */

function runRules(src: Source, fns: Fn[], classes: Cls[]): Review['categories'] {
  const f = new Findings(src);
  const isTs = src.language === 'typescript';
  const code = src.code;
  const totalLines = src.rawLines.length;
  const hasExports = /\bexport\b|module\.exports|\bexports\./.test(code);

  /* ---- Code style ---- */
  f.lines(
    'codeStyle',
    {
      title: 'Use let/const instead of var',
      severity: 'low',
      description: '`var` is function-scoped and hoisted, which makes code harder to reason about.',
      suggestion: 'Replace `var` with `const` (or `let` if the variable is reassigned).',
    },
    src.hits(/\bvar\s+[A-Za-z_$]/),
  );

  const longLines = src.rawLines.map((l, i) => (l.length > 120 ? i + 1 : 0)).filter(Boolean);
  f.lines(
    'codeStyle',
    {
      title: 'Line is too long',
      severity: 'low',
      description: 'Lines over 120 characters are hard to read and review.',
      suggestion: 'Break the statement over several lines or extract a variable.',
    },
    longLines,
  );

  const snake = src.hits(/\b(?:const|let|var|function)\s+[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/);
  f.lines(
    'codeStyle',
    {
      title: 'Use camelCase names',
      severity: 'low',
      description: 'JavaScript convention is camelCase for variables and functions.',
      suggestion: 'Rename snake_case identifiers to camelCase.',
    },
    snake,
  );

  const shortNames = src.hits(/\b(?:const|let|var)\s+(?![ijk_]\b)[A-Za-z]\s*=/);
  f.lines(
    'codeStyle',
    {
      title: 'Single-letter variable name',
      severity: 'info',
      description: 'Names like `a` or `d` do not say what the value means.',
      suggestion: 'Use a descriptive name such as `total` or `userCount`.',
    },
    shortNames,
  );

  const commented = src.rawLines
    .map((l, i) => {
      const t = l.trim();
      if (!t.startsWith('//')) return 0;
      const body = t.replace(/^\/\/+\s*/, '');
      return /^[\w$.[\]'"]+\s*[-+*/]?=\s*.+;$|^[\w$.]+\([^)]*\);$|^(?:const|let|var|return|if|for)\b.*[;{]$/.test(body) ? i + 1 : 0;
    })
    .filter(Boolean);
  f.lines(
    'codeStyle',
    {
      title: 'Commented-out code',
      severity: 'info',
      description: 'Dead code in comments clutters the file; version control already keeps history.',
      suggestion: 'Delete it, or restore it as real code if it is still needed.',
    },
    commented,
  );

  const tabLines = src.rawLines.map((l, i) => (/^\t/.test(l) ? i + 1 : 0)).filter(Boolean);
  const spaceLines = src.rawLines.filter((l) => /^ {2,}\S/.test(l)).length;
  if (tabLines.length > 0 && spaceLines > 0) {
    f.one(
      'codeStyle',
      {
        title: 'Mixed tabs and spaces',
        severity: 'low',
        description: 'The file indents with both tabs and spaces, so it looks different in every editor.',
        suggestion: 'Pick one (2 spaces is common) and let Prettier or an .editorconfig enforce it.',
      },
      tabLines[0],
    );
  }

  const singleQ = src.noComment.match(/'[^'\n]*'/g)?.length ?? 0;
  const doubleQ = src.noComment.match(/"[^"\n]*"/g)?.length ?? 0;
  if (singleQ >= 3 && doubleQ >= 3) {
    f.one(
      'codeStyle',
      {
        title: 'Inconsistent quote style',
        severity: 'info',
        description: `Both single quotes (${singleQ}) and double quotes (${doubleQ}) are used for strings.`,
        suggestion: 'Choose one quote style and enforce it with a formatter or ESLint `quotes` rule.',
      },
      null,
    );
  }

  /* ---- Best practices ---- */
  f.lines(
    'bestPractices',
    {
      title: 'Leftover console.log',
      severity: 'info',
      description: 'Debug logging should not ship to production.',
      suggestion: 'Remove it, or replace it with a real logger that can be turned off.',
    },
    src.hits(/\bconsole\.(?:log|debug|info)\s*\(/),
  );

  // let that is never reassigned -> const
  const letHits: number[] = [];
  const letNames = new Map<number, string>();
  src.codeLines.forEach((l, i) => {
    const m = l.match(/^\s*(?:export\s+)?let\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=/);
    if (m && !/,/.test(l.split('=')[0]) && neverReassigned(code, m[1])) {
      letHits.push(i + 1);
      letNames.set(i + 1, m[1]);
    }
  });
  f.lines(
    'bestPractices',
    {
      title: 'Use const for values that never change',
      severity: 'low',
      description: 'This variable is declared with `let` but never reassigned.',
      suggestion: 'Declare it with `const` so readers know it cannot change.',
    },
    letHits,
    (line, _t) => `\`${letNames.get(line)}\` is declared with \`let\` but never reassigned.`,
  );

  f.lines(
    'bestPractices',
    {
      title: 'Unresolved TODO/FIXME',
      severity: 'info',
      description: 'A TODO-style comment marks unfinished work.',
      suggestion: 'Finish it, or track it as an issue and remove the comment.',
    },
    src.rawLines.map((l, i) => (/(?:\/\/|\/\*|^\s*\*).*\b(?:TODO|FIXME|HACK|XXX)\b/.test(l) ? i + 1 : 0)).filter(Boolean),
  );

  const emptyCatch: number[] = [];
  for (const m of code.matchAll(/catch\s*(?:\([^)]*\))?\s*\{\s*\}/g)) emptyCatch.push(src.lineOfIndex(m.index!));
  f.lines(
    'bestPractices',
    {
      title: 'Empty catch block swallows errors',
      severity: 'medium',
      description: 'Errors are caught and silently ignored, so failures become invisible.',
      suggestion: 'Handle the error, log it, or re-throw it.',
    },
    emptyCatch,
  );

  if (isTs) {
    f.lines(
      'bestPractices',
      {
        title: 'Avoid the any type',
        severity: 'low',
        description: '`any` turns off type checking for this value.',
        suggestion: 'Use a precise type, a generic, or `unknown` plus narrowing.',
      },
      src.hits(/:\s*any\b|\bas\s+any\b|<any>/),
    );
  }

  const undocumented = fns.filter((fn) => !fn.hasDoc && !fn.owner);
  if (undocumented.length > 0) {
    f.one(
      'bestPractices',
      {
        title: `${undocumented.length} function${undocumented.length === 1 ? '' : 's'} without a doc comment`,
        severity: 'info',
        description: `No comment explains: ${undocumented.slice(0, 5).map((u) => u.name).join(', ')}${undocumented.length > 5 ? ', ...' : ''}.`,
        suggestion: 'Add a short JSDoc block describing purpose, parameters and return value.',
      },
      undocumented[0].line,
    );
  }

  /* ---- Design patterns ---- */
  for (const fn of fns.filter((x) => x.params.length > 4).slice(0, MAX_PER_RULE)) {
    f.one(
      'designPatterns',
      {
        title: 'Function takes too many parameters',
        severity: 'medium',
        description: `\`${fn.name}\` has ${fn.params.length} parameters, which makes calls easy to get wrong.`,
        suggestion: 'Group related parameters into one options object (parameter object pattern).',
      },
      fn.line,
    );
  }

  let depth = 0;
  let maxDepth = 0;
  let deepLine: number | null = null;
  src.codeLines.forEach((l, i) => {
    for (const ch of l) {
      if (ch === '{') {
        depth++;
        if (depth > maxDepth) {
          maxDepth = depth;
          if (depth >= 5 && deepLine === null) deepLine = i + 1;
        }
      } else if (ch === '}') depth = Math.max(0, depth - 1);
    }
  });
  if (deepLine !== null) {
    f.one(
      'designPatterns',
      {
        title: 'Deeply nested code',
        severity: 'medium',
        description: `Blocks are nested ${maxDepth} levels deep, which is hard to follow and test.`,
        suggestion: 'Use early returns (guard clauses) and extract inner blocks into small named functions.',
      },
      deepLine,
    );
  }

  const globals = topLevelVariables(src).filter((v) => v.keyword !== 'const' && !fns.some((fn) => fn.name === v.name));
  if (globals.length > 3) {
    f.one(
      'designPatterns',
      {
        title: 'Many top-level mutable variables',
        severity: 'low',
        description: `${globals.length} top-level \`let\`/\`var\` variables (${globals
          .slice(0, 4)
          .map((g) => g.name)
          .join(', ')}${globals.length > 4 ? ', ...' : ''}) act as shared global state.`,
        suggestion: 'Wrap related state in a function, class or module so it has a clear owner.',
      },
      globals[0].line,
    );
  }

  const thenCalls = src.hits(/\.then\s*\(/);
  if (thenCalls.length >= 2) {
    f.one(
      'designPatterns',
      {
        title: 'Promise chains instead of async/await',
        severity: 'low',
        description: `${thenCalls.length} \`.then()\` calls make the control flow harder to follow.`,
        suggestion: 'Rewrite the chain with async/await and a single try/catch.',
      },
      thenCalls[0],
    );
  }

  for (const c of classes.filter((x) => x.methodCount > 10).slice(0, 2)) {
    f.one(
      'designPatterns',
      {
        title: 'Large class',
        severity: 'low',
        description: `\`${c.name}\` has ${c.methodCount} methods and probably has more than one responsibility.`,
        suggestion: 'Split it by responsibility (single responsibility principle).',
      },
      c.line,
    );
  }

  if ((fns.length > 0 || classes.length > 0) && !hasExports) {
    f.one(
      'designPatterns',
      {
        title: 'Nothing is exported',
        severity: 'info',
        description: 'No `export` / `module.exports` found, so other modules and unit tests cannot import this code.',
        suggestion: 'Export the functions or classes that form the public API of this file.',
      },
      null,
    );
  }

  /* ---- Possible bugs ---- */
  const looseEq: number[] = [];
  src.codeLines.forEach((l, i) => {
    if (/(?<![=!<>])==(?!=)(?!\s*null\b)|!=(?!=)(?!\s*null\b)/.test(l)) looseEq.push(i + 1);
  });
  f.lines(
    'possibleBugs',
    {
      title: 'Loose equality (==)',
      severity: 'medium',
      description: '`==` / `!=` perform type coercion and can hide bugs (e.g. `0 == ""` is true).',
      suggestion: 'Use strict equality `===` / `!==`.',
    },
    looseEq,
  );

  f.lines(
    'possibleBugs',
    {
      title: 'Assignment inside a condition',
      severity: 'high',
      description: 'A single `=` inside `if`/`while` assigns instead of comparing.',
      suggestion: 'Use `===` to compare, or move the assignment out of the condition.',
    },
    src.hits(/\b(?:if|while)\s*\(\s*[A-Za-z_$][\w$.]*\s*=(?![=>])/),
  );

  f.lines(
    'possibleBugs',
    {
      title: 'Comparison with NaN is always false',
      severity: 'high',
      description: '`NaN` is never equal to anything, including itself.',
      suggestion: 'Use `Number.isNaN(value)`.',
    },
    src.hits(/[!=]==?\s*NaN\b|\bNaN\s*[!=]==?/),
  );

  f.lines(
    'possibleBugs',
    {
      title: 'Invalid typeof comparison',
      severity: 'high',
      description: '`typeof` only returns a fixed set of strings; this comparison can never be true.',
      suggestion: 'Compare with one of: "string", "number", "boolean", "object", "function", "undefined", "symbol", "bigint".',
    },
    src.hits(
      /typeof\s+[\w$.]+\s*[!=]==?\s*(['"])(?!(?:undefined|object|boolean|number|bigint|string|symbol|function)\1)/,
      src.noCommentLines,
    ),
  );

  f.lines(
    'possibleBugs',
    {
      title: 'async callback inside forEach',
      severity: 'medium',
      description: '`forEach` does not wait for async callbacks, so awaited work is not finished when the loop ends.',
      suggestion: 'Use `for...of` with await, or `await Promise.all(items.map(async ...))`.',
    },
    src.hits(/\.forEach\s*\(\s*async\b/),
  );

  f.lines(
    'possibleBugs',
    {
      title: 'parseInt without radix',
      severity: 'low',
      description: 'Without a radix, `parseInt` may interpret the text in an unexpected base.',
      suggestion: 'Pass the radix explicitly: `parseInt(value, 10)`.',
    },
    src.hits(/\bparseInt\s*\((?:[^(),]|\([^()]*\))*\)/),
  );

  f.lines(
    'possibleBugs',
    {
      title: 'Possible off-by-one in loop',
      severity: 'medium',
      description: 'Looping with `<=` up to `.length` reads one element past the end.',
      suggestion: 'Use `i < array.length`.',
    },
    src.hits(/\bfor\s*\([^;]*;\s*[\w$]+\s*<=\s*[\w$.]+\.length\b/),
  );

  // awaited calls outside any try block
  const tryRanges: Array<[number, number]> = [];
  for (const m of code.matchAll(/\btry\s*\{/g)) {
    const open = m.index! + m[0].length - 1;
    const close = matchBracket(code, open);
    if (close > 0) tryRanges.push([open, close]);
  }
  const unguarded: number[] = [];
  for (const m of code.matchAll(/\bawait\b/g)) {
    if (!tryRanges.some(([a, b]) => m.index! > a && m.index! < b)) {
      const line = src.lineOfIndex(m.index!);
      if (!unguarded.includes(line)) unguarded.push(line);
    }
  }
  f.lines(
    'possibleBugs',
    {
      title: 'await without error handling',
      severity: 'medium',
      description: 'If this promise rejects, the error is unhandled and the caller or process may crash.',
      suggestion: 'Wrap the awaited call in try/catch, or make sure the caller handles the rejection.',
    },
    unguarded,
  );

  const awaitOutsideAsync = fns
    .filter((fn) => !fn.isAsync && !/\basync\b/.test(code.slice(fn.bodyStart, fn.bodyEnd + 1)))
    .map((fn) => {
      const m = code.slice(fn.bodyStart, fn.bodyEnd + 1).match(/\bawait\b/);
      return m ? src.lineOfIndex(fn.bodyStart + m.index!) : 0;
    })
    .filter(Boolean);
  f.lines(
    'possibleBugs',
    {
      title: 'await used in a non-async function',
      severity: 'high',
      description: '`await` is only allowed inside an `async` function; this is a syntax error.',
      suggestion: 'Mark the enclosing function `async`.',
    },
    awaitOutsideAsync,
  );

  if (thenCalls.length > 0 && !/\.catch\s*\(/.test(code)) {
    f.one(
      'possibleBugs',
      {
        title: 'Promise chain has no .catch()',
        severity: 'medium',
        description: 'A rejected promise here will go unhandled.',
        suggestion: 'Add `.catch(handleError)` at the end of the chain, or switch to async/await with try/catch.',
      },
      thenCalls[0],
    );
  }

  // variable changes type: let x = "hi"; x = 10;
  const kinds = new Map<string, LiteralKind>();
  const typeChanges: number[] = [];
  const typeDetail = new Map<number, string>();
  src.noCommentLines.forEach((l, i) => {
    const decl = l.match(/^\s*(?:export\s+)?(?:let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;]+);?\s*$/);
    if (decl) {
      const k = literalKind(decl[2]);
      if (k) kinds.set(decl[1], k);
      else kinds.delete(decl[1]);
      return;
    }
    const asg = l.match(/^\s*([A-Za-z_$][\w$]*)\s*=\s*([^;=][^;]*);?\s*$/);
    if (asg && kinds.has(asg[1])) {
      const k = literalKind(asg[2]);
      const prev = kinds.get(asg[1])!;
      if (k && k !== prev) {
        typeChanges.push(i + 1);
        typeDetail.set(i + 1, `\`${asg[1]}\` was a ${prev} and is now assigned a ${k}.`);
        kinds.set(asg[1], k);
      }
    }
  });
  f.lines(
    'possibleBugs',
    {
      title: 'Variable changes type',
      severity: isTs ? 'medium' : 'low',
      description: 'The variable holds a different type than before.',
      suggestion: isTs
        ? 'Declare a union type (e.g. `string | number`) or use separate variables; TypeScript will reject this assignment.'
        : 'Use a separate variable for the new value so the type of each variable stays predictable.',
    },
    typeChanges,
    (line) => typeDetail.get(line) ?? 'The variable holds a different type than before.',
  );

  // unreachable code after return/throw
  const unreachable: number[] = [];
  src.codeLines.forEach((l, i) => {
    if (!/^\s*(?:return\b[^({[]*|throw\b[^({[]*|break|continue);\s*$/.test(l)) return;
    for (let j = i + 1; j < src.codeLines.length; j++) {
      const next = src.codeLines[j].trim();
      if (next === '') continue;
      if (!/^(?:\}|\)|\]|case\b|default\b|function\b|else\b|catch\b|finally\b)/.test(next)) unreachable.push(j + 1);
      break;
    }
  });
  f.lines(
    'possibleBugs',
    {
      title: 'Unreachable code',
      severity: 'medium',
      description: 'This statement comes straight after a return/throw/break and can never run.',
      suggestion: 'Remove it or move it before the return.',
    },
    unreachable,
  );

  /* ---- Security ---- */
  f.lines(
    'securityIssues',
    {
      title: 'Use of eval()',
      severity: 'critical',
      description: '`eval` executes arbitrary strings as code and is a classic injection vector.',
      suggestion: 'Remove `eval`; parse data with JSON.parse or use explicit logic.',
    },
    src.hits(/\beval\s*\(/),
  );

  f.lines(
    'securityIssues',
    {
      title: 'Dynamic code via new Function()',
      severity: 'high',
      description: '`new Function` compiles strings into code, like `eval`.',
      suggestion: 'Replace it with normal functions or a lookup table of allowed operations.',
    },
    src.hits(/\bnew\s+Function\s*\(/),
  );

  const htmlSinks = src.hits(/\.(?:innerHTML|outerHTML)\s*[+]?=|\bdocument\.write(?:ln)?\s*\(|\.insertAdjacentHTML\s*\(/, src.noCommentLines);
  f.lines(
    'securityIssues',
    {
      title: 'Possible XSS through HTML injection',
      severity: 'high',
      description: 'Writing strings into the page as HTML lets attacker-controlled text run as script.',
      suggestion: 'Use `textContent`, or sanitize the HTML (e.g. DOMPurify) before inserting it.',
    },
    htmlSinks,
  );

  f.lines(
    'securityIssues',
    {
      title: 'Hard-coded secret',
      severity: 'high',
      description: 'Secrets in source code leak through version control.',
      suggestion: 'Load secrets from environment variables (`process.env`) and keep `.env` out of Git.',
    },
    src.hits(/(?:api[_-]?key|secret|passw(?:or)?d|token|auth)\w*\s*[:=]\s*(['"`])[^'"`\s]{4,}\1/i, src.noCommentLines),
  );

  f.lines(
    'securityIssues',
    {
      title: 'Possible SQL injection',
      severity: 'high',
      description: 'A SQL statement is built by joining strings with variables.',
      suggestion: 'Use parameterized queries / prepared statements (or an ORM such as Prisma).',
    },
    src.hits(
      /(?:select\s.+\sfrom|insert\s+into|update\s+\w+\s+set|delete\s+from)\s.*(?:['"`]\s*\+|\+\s*['"`\w]|\$\{)/i,
      src.noCommentLines,
    ),
  );

  f.lines(
    'securityIssues',
    {
      title: 'Possible command injection',
      severity: 'high',
      description: 'A shell command is built from variable text.',
      suggestion: 'Use `execFile` with an argument array, and validate any user input.',
    },
    src.hits(/\bexec(?:Sync)?\s*\([^)]*(?:\+|\$\{)/, src.noCommentLines),
  );

  f.lines(
    'securityIssues',
    {
      title: 'TLS certificate checks disabled',
      severity: 'high',
      description: 'Turning off certificate validation allows man-in-the-middle attacks.',
      suggestion: 'Remove `rejectUnauthorized: false` and fix the certificate instead.',
    },
    src.hits(/rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED/, src.noCommentLines),
  );

  f.lines(
    'securityIssues',
    {
      title: 'Insecure random for secrets',
      severity: 'medium',
      description: '`Math.random()` is predictable and must not be used for tokens, passwords or keys.',
      suggestion: 'Use `crypto.randomUUID()` or `crypto.randomBytes()`.',
    },
    src.hits(/Math\.random\s*\(.*|.*Math\.random/, src.noCommentLines).filter((l) =>
      /token|secret|passw|key|session|nonce/i.test(src.rawLines[l - 1]),
    ),
  );

  f.lines(
    'securityIssues',
    {
      title: 'Plain http:// URL',
      severity: 'low',
      description: 'Traffic over HTTP is not encrypted.',
      suggestion: 'Use https:// for anything except local development.',
    },
    src.hits(/['"`]http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)/, src.noCommentLines),
  );

  f.lines(
    'securityIssues',
    {
      title: 'Token stored in localStorage',
      severity: 'low',
      description: 'Any script on the page can read localStorage, so an XSS bug exposes the token.',
      suggestion: 'Prefer an httpOnly, Secure cookie for session tokens.',
    },
    src.hits(/localStorage\.setItem\s*\(\s*['"`][^'"`]*(?:token|jwt|session)/i, src.noCommentLines),
  );

  /* ---- Refactoring ---- */
  if (totalLines >= 80) {
    f.one(
      'refactoring',
      {
        title: 'Long file',
        severity: 'low',
        description: `The file has ${totalLines} lines; large files are hard to maintain.`,
        suggestion: 'Split it into smaller modules grouped by responsibility.',
      },
      null,
    );
  }

  for (const fn of fns.filter((x) => x.endLine - x.line + 1 > 40).slice(0, MAX_PER_RULE)) {
    f.one(
      'refactoring',
      {
        title: 'Long function',
        severity: 'medium',
        description: `\`${fn.name}\` is ${fn.endLine - fn.line + 1} lines long and likely does several things.`,
        suggestion: 'Extract cohesive steps into small, well-named helper functions.',
      },
      fn.line,
    );
  }

  // repeated lines
  const seen = new Map<string, number[]>();
  src.codeLines.forEach((l, i) => {
    const t = l.trim().replace(/\s+/g, ' ');
    if (t.length < 25 || /^[})\];,\s]*$/.test(t)) return;
    seen.set(t, [...(seen.get(t) ?? []), i + 1]);
  });
  const dupes = [...seen.entries()].filter(([, ls]) => ls.length >= 3).sort((a, b) => b[1].length - a[1].length);
  for (const [, ls] of dupes.slice(0, 2)) {
    f.one(
      'refactoring',
      {
        title: 'Repeated code',
        severity: 'low',
        description: `The same statement appears ${ls.length} times (lines ${ls.slice(0, 6).join(', ')}${ls.length > 6 ? ', ...' : ''}).`,
        suggestion: 'Extract it into a function or loop, so a change is made in one place.',
      },
      ls[0],
    );
  }

  // magic numbers
  const numCount = new Map<string, number[]>();
  src.codeLines.forEach((l, i) => {
    if (/^\s*(?:export\s+)?const\s+[A-Z][A-Z0-9_]*\s*=/.test(l)) return;
    for (const m of l.matchAll(/(?<![\w$.])(\d{3,}|\d+\.\d{2,})(?![\w$])/g)) {
      numCount.set(m[1], [...(numCount.get(m[1]) ?? []), i + 1]);
    }
  });
  for (const [num, ls] of [...numCount.entries()].filter(([, l]) => l.length >= 3).slice(0, 2)) {
    f.one(
      'refactoring',
      {
        title: 'Magic number',
        severity: 'low',
        description: `The number ${num} is repeated ${ls.length} times without a name.`,
        suggestion: 'Define a named constant, e.g. `const MAX_ITEMS = ' + num + ';`.',
      },
      ls[0],
    );
  }

  // related top-level variables -> object
  const groups = new Map<string, string[]>();
  for (const v of topLevelVariables(src)) {
    const first = v.name.match(/^[a-z]+/)?.[0];
    if (first && first.length >= 3 && v.name.length > first.length) groups.set(first, [...(groups.get(first) ?? []), v.name]);
  }
  for (const [prefix, names] of [...groups.entries()].filter(([, n]) => n.length >= 3).slice(0, 2)) {
    const line = topLevelVariables(src).find((v) => v.name === names[0])!.line;
    f.one(
      'refactoring',
      {
        title: 'Related variables could be one object',
        severity: 'low',
        description: `Variables ${names.slice(0, 4).map((n) => '`' + n + '`').join(', ')} all start with "${prefix}".`,
        suggestion: `Group them: \`const ${prefix} = { ... };\``,
      },
      line,
    );
  }

  // array used as a record
  const records: number[] = [];
  src.noCommentLines.forEach((l, i) => {
    const m = l.match(/=\s*\[([^\]\[]+)\]\s*;?\s*$/);
    if (!m) return;
    const ks = splitTopLevel(m[1]).map(literalKind);
    if (ks.length >= 2 && ks.every(Boolean) && new Set(ks).size >= 2) records.push(i + 1);
  });
  f.lines(
    'refactoring',
    {
      title: 'Array used as a record',
      severity: 'low',
      description: 'An array mixes different kinds of values, so readers must remember what each index means.',
      suggestion: 'Use an object with named fields (or a typed tuple/interface in TypeScript).',
    },
    records,
  );

  f.lines(
    'refactoring',
    {
      title: 'Index loop can be simplified',
      severity: 'info',
      description: 'A classic counting loop only reads each element.',
      suggestion: 'Use `for (const item of items)` or `items.map/filter/reduce`.',
    },
    src.hits(/\bfor\s*\(\s*(?:let|var)\s+(\w+)\s*=\s*0\s*;\s*\1\s*<\s*[\w$.]+\.length\s*;\s*\1\+\+\s*\)/),
  );

  f.lines(
    'refactoring',
    {
      title: 'Nested ternary',
      severity: 'low',
      description: 'Chained `? :` expressions are hard to read.',
      suggestion: 'Use if/else, a lookup object, or a small helper function.',
    },
    src.hits(/\?[^:?\n]*\?[^:\n]*:/),
  );

  return f.result();
}

/* -------------------------------------------------------------------------- */
/* refactoredCode                                                              */
/* -------------------------------------------------------------------------- */

/** Replaces matches found in the blanked line at the same positions in the raw line. */
function replaceInRaw(raw: string, blanked: string, re: RegExp, replacer: (m: RegExpMatchArray) => string): string {
  let out = '';
  let last = 0;
  for (const m of blanked.matchAll(re)) {
    out += raw.slice(last, m.index!) + replacer(m);
    last = m.index! + m[0].length;
  }
  return out + raw.slice(last);
}

function buildRefactoredCode(src: Source): string {
  const out: string[] = [];
  src.rawLines.forEach((raw, i) => {
    const blanked = src.codeLines[i];
    const trimmed = blanked.trim();

    // drop whole-line console.log/debug/info statements
    if (/^console\.(?:log|debug|info)\s*\(.*\)\s*;?$/.test(trimmed)) {
      const opens = (blanked.match(/\(/g) ?? []).length;
      const closes = (blanked.match(/\)/g) ?? []).length;
      if (opens === closes) return;
    }

    let line = raw;
    // var -> const / let
    line = replaceInRaw(line, blanked, /\bvar(?=\s+([A-Za-z_$][\w$]*))/g, (m) => {
      const name = blanked.slice(m.index! + m[0].length).match(/^\s+([A-Za-z_$][\w$]*)/)![1];
      return /,/.test(blanked) || !neverReassigned(src.code, name) ? 'let' : 'const';
    });
    // let never reassigned -> const
    const letMatch = blanked.match(/^(\s*(?:export\s+)?)let(\s+)([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=/);
    if (letMatch && !/,/.test(blanked.split('=')[0]) && neverReassigned(src.code, letMatch[3])) {
      line = replaceInRaw(line, blanked, /^(\s*(?:export\s+)?)let(?=\s)/g, (m) => `${m[1]}const`);
    }
    // == -> ===, != -> !==
    line = replaceInRaw(line, blanked, /(?<![=!<>])==(?!=)(?!\s*null\b)/g, () => '===');
    line = replaceInRaw(line, blanked, /!=(?!=)(?!\s*null\b)/g, () => '!==');
    // parseInt(x) -> parseInt(x, 10)
    line = replaceInRaw(line, blanked, /\bparseInt\s*\(((?:[^(),]|\([^()]*\))*)\)/g, (m) => `parseInt(${m[1]}, 10)`);
    out.push(line);
  });
  return out.join('\n');
}

/* -------------------------------------------------------------------------- */
/* Documentation + unit test stubs                                             */
/* -------------------------------------------------------------------------- */

function describeFn(src: Source, fn: Fn): string {
  const body = src.code.slice(fn.bodyStart, fn.bodyEnd + 1);
  const notes: string[] = [];
  if (fn.isAsync) notes.push('runs asynchronously');
  if (/\bfetch\s*\(|\baxios\b|\.query\s*\(|\.find\w*\s*\(/.test(body)) notes.push('performs I/O');
  if (/\bthrow\b/.test(body)) notes.push('can throw an error');
  if (/\bconsole\./.test(body)) notes.push('writes to the console');
  const purpose = `${words(fn.name)}.`;
  return notes.length ? `${purpose} It ${notes.join(', ')}.` : purpose;
}

function callsOf(src: Source, fn: Fn, all: Fn[]): string[] {
  const body = src.code.slice(fn.bodyStart, fn.bodyEnd + 1);
  const out: string[] = [];
  for (const other of all) {
    if (other.id === fn.id) continue;
    const re = other.owner
      ? new RegExp(`\\bthis\\.${escapeRe(other.name)}\\s*\\(`)
      : new RegExp(`(?<![\\w$.])${escapeRe(other.name)}\\s*\\(`);
    if (other.owner && other.owner !== fn.owner) continue;
    if (re.test(body)) out.push(other.id);
  }
  return out;
}

function buildDocumentation(src: Source, fns: Fn[], classes: Cls[], summaryCounts: { issues: number; score: number }): string {
  const lang = src.language === 'typescript' ? 'TypeScript' : 'JavaScript';
  const lines: string[] = [];
  const vars = topLevelVariables(src).filter((v) => !fns.some((fn) => fn.name === v.name));
  const first = src.rawLines.find((l) => /^\s*(?:\/\/|\/\*+|\*)\s*\S/.test(l));
  lines.push('# Module documentation', '');
  lines.push(
    `This ${lang} module has ${src.rawLines.length} lines, ${fns.filter((f) => !f.owner).length} function(s), ${classes.length} class(es) and ${vars.length} top-level variable(s).`,
  );
  if (first) lines.push('', `> ${first.replace(/^\s*(?:\/\/+|\/\*+|\*)\s*/, '').replace(/\*\/\s*$/, '').trim()}`);
  lines.push('', `Automated review score: **${summaryCounts.score}/100** with ${summaryCounts.issues} finding(s).`, '');

  const plain = fns.filter((f) => !f.owner);
  if (plain.length) {
    lines.push('## Functions', '');
    for (const fn of plain) {
      lines.push(`### \`${fn.name}(${fn.params.map((p) => p.name).join(', ')})\``, '');
      lines.push(`${describeFn(src, fn)} Defined on line ${fn.line}${fn.exported ? ' and exported' : ''}.`, '');
      if (fn.params.length) {
        lines.push('| Parameter | Type | Required |', '| --- | --- | --- |');
        for (const p of fn.params) lines.push(`| \`${p.name}\` | ${p.type ? '`' + p.type + '`' : '-'} | ${p.optional ? 'no' : 'yes'} |`);
        lines.push('');
      }
      const body = src.code.slice(fn.bodyStart, fn.bodyEnd + 1);
      lines.push(`**Returns:** ${/\breturn\s+[^;\s]/.test(body) || /=>\s*[^{\s]/.test(src.code.slice(fn.bodyStart - 3, fn.bodyStart + 3)) ? 'a value (see the return statements).' : 'nothing (`void`).'}`);
      const calls = callsOf(src, fn, fns);
      if (calls.length) lines.push('', `**Calls:** ${calls.map((c) => '`' + c + '`').join(', ')}`);
      lines.push('');
    }
  }

  for (const c of classes) {
    lines.push(`## Class \`${c.name}\``, '');
    lines.push(`Defined on line ${c.line}${c.extendsName ? `, extends \`${c.extendsName}\`` : ''}.`, '');
    for (const m of fns.filter((f) => f.owner === c.name)) {
      lines.push(`- \`${m.name}(${m.params.map((p) => p.name).join(', ')})\`: ${describeFn(src, m)}`);
    }
    lines.push('');
  }

  if (vars.length) {
    lines.push('## Top-level variables', '');
    for (const v of vars.slice(0, 15)) lines.push(`- \`${v.name}\` (${v.keyword}, line ${v.line})`);
    if (vars.length > 15) lines.push(`- ... and ${vars.length - 15} more`);
    lines.push('');
  }

  if (!plain.length && !classes.length) lines.push('No functions or classes were detected in this file.', '');
  lines.push('---', '_Generated by the offline mock analyzer. A real AI provider writes richer descriptions._');
  return lines.join('\n');
}

function sampleValue(p: Param, isTs: boolean): string {
  const type = p.type?.toLowerCase() ?? '';
  const n = p.name.toLowerCase();
  if (/^number$|^int/.test(type)) return '1';
  if (/^string$/.test(type)) return "'sample'";
  if (/^boolean$/.test(type)) return 'true';
  if (/\[\]$|^array/.test(type)) return '[]';
  if (type && !/^(any|unknown)$/.test(type)) return isTs ? '{} as never' : '{}';
  if (/(^|[^a-z])(is|has|can|should|flag|enabled)/.test(n) || /^(is|has)[A-Z]/.test(p.name)) return 'true';
  if (/name|title|text|str|label|email|url|path|key|msg|message/.test(n)) return "'sample'";
  if (/count|num|age|price|total|amount|index|size|len|^[abnxyz]$|value|qty|score/.test(n)) return '1';
  if (/list|items|arr|array|scores|students|names|values/.test(n)) return '[]';
  if (/obj|option|config|data|user|payload|body|params|props/.test(n)) return '{}';
  return 'undefined';
}

function buildTestStubs(src: Source, fns: Fn[], classes: Cls[]): string {
  const isTs = src.language === 'typescript';
  const out: string[] = ['// Auto-generated test stubs (offline mock). Replace the TODOs with real inputs and expectations.'];
  const topFns = fns.filter((f) => !f.owner);
  const exportedNames = [...topFns.filter((f) => f.exported).map((f) => f.name), ...classes.filter((c) => c.exported).map((c) => c.name)];
  if (exportedNames.length) out.push(`import { ${exportedNames.join(', ')} } from './module'; // TODO: fix the path`);
  else if (fns.length) out.push("// NOTE: nothing is exported yet. Export the code under test, then import it here:\n// import { ... } from './module';");
  out.push('');

  const callExpr = (fn: Fn, args: string[]) => {
    const target = fn.owner ? `instance.${fn.name}` : fn.name;
    return `${target}(${args.join(', ')})`;
  };

  const writeTests = (fn: Fn, indent: string) => {
    const body = src.code.slice(fn.bodyStart, fn.bodyEnd + 1);
    const returnsValue = /\breturn\s+[^;\s]/.test(body) || (fn.bodyStart > 0 && src.code[fn.bodyStart] !== '{');
    const args = fn.params.filter((p) => !p.optional).map((p) => sampleValue(p, isTs));
    const call = callExpr(fn, args);
    const asyncKw = fn.isAsync ? 'async ' : '';
    const aw = fn.isAsync ? 'await ' : '';
    const label = fn.owner ? fn.name : fn.name;
    out.push(`${indent}describe('${label}', () => {`);
    out.push(`${indent}  it('works for valid input', ${asyncKw}() => {`);
    out.push(`${indent}    // TODO: arrange real input values`);
    if (returnsValue) {
      out.push(`${indent}    const result = ${aw}${call};`);
      out.push(`${indent}    expect(result).toBeDefined(); // TODO: assert the exact expected value`);
    } else if (fn.isAsync) {
      out.push(`${indent}    await expect(${call}).resolves.not.toThrow(); // TODO: assert the side effect`);
    } else {
      out.push(`${indent}    expect(() => ${call}).not.toThrow(); // TODO: assert the side effect`);
    }
    out.push(`${indent}  });`);
    if (fn.params.length > 0) {
      out.push('');
      out.push(`${indent}  it.todo('handles missing or invalid input'); // decide: throw, or return a default?`);
    }
    if (/\bthrow\b/.test(body)) {
      out.push('');
      out.push(`${indent}  it('throws the documented error', () => {`);
      out.push(`${indent}    // TODO: pass input that triggers the throw statement`);
      out.push(`${indent}    expect(() => ${callExpr(fn, args)}).toThrow();`);
      out.push(`${indent}  });`);
    }
    const branches = (body.match(/\b(?:if|switch|case|\?)\b|\?(?!\.)/g) ?? []).length;
    if (branches > 1) {
      out.push('');
      out.push(`${indent}  it.todo('covers each branch (${branches} conditional branches detected)');`);
    }
    out.push(`${indent}});`);
    out.push('');
  };

  for (const fn of topFns.slice(0, 12)) writeTests(fn, '');
  for (const c of classes.slice(0, 4)) {
    out.push(`describe('${c.name}', () => {`);
    out.push(`  const instance = new ${c.name}(); // TODO: pass constructor arguments`);
    out.push('');
    for (const m of fns.filter((f) => f.owner === c.name && f.name !== 'constructor').slice(0, 8)) writeTests(m, '  ');
    out.push('});', '');
  }
  if (!topFns.length && !classes.length) {
    out.push("describe('module', () => {", "  it.todo('add tests once the code exposes functions or classes');", '});', '');
  }
  return out.join('\n').trimEnd() + '\n';
}

/* -------------------------------------------------------------------------- */
/* Structure graph                                                             */
/* -------------------------------------------------------------------------- */

function buildStructure(src: Source, fns: Fn[], classes: Cls[]): Review['structure'] {
  const nodes: Review['structure']['nodes'] = [{ id: 'module', label: 'module', type: 'module', line: null }];
  const edges: Review['structure']['edges'] = [];
  const ids = new Set<string>(['module']);
  const addNode = (id: string, label: string, type: Review['structure']['nodes'][number]['type'], line: number | null) => {
    if (ids.has(id) || nodes.length >= MAX_NODES) return false;
    ids.add(id);
    nodes.push({ id, label, type, line });
    return true;
  };
  const addEdge = (from: string, to: string, relation: Review['structure']['edges'][number]['relation']) => {
    if (!ids.has(from) || !ids.has(to) || from === to) return;
    if (edges.some((e) => e.from === from && e.to === to && e.relation === relation)) return;
    edges.push({ from, to, relation });
  };

  for (const c of classes) if (addNode(c.name, c.name, 'class', c.line)) addEdge('module', c.name, 'contains');
  for (const fn of fns) {
    if (!addNode(fn.id, fn.owner ? `${fn.owner}.${fn.name}` : fn.name, 'function', fn.line)) continue;
    addEdge(fn.owner ?? 'module', fn.id, 'contains');
  }
  for (const c of classes) if (c.extendsName) addEdge(c.name, c.extendsName, 'extends');

  const vars = topLevelVariables(src).filter((v) => !fns.some((fn) => fn.name === v.name) && !classes.some((c) => c.name === v.name));
  for (const v of vars.slice(0, 8)) if (addNode(v.name, v.name, 'variable', v.line)) addEdge('module', v.name, 'contains');

  for (const fn of fns) {
    const body = src.code.slice(fn.bodyStart, fn.bodyEnd + 1);
    for (const callee of callsOf(src, fn, fns)) addEdge(fn.id, callee, 'calls');
    for (const c of classes) if (new RegExp(`\\bnew\\s+${escapeRe(c.name)}\\b`).test(body)) addEdge(fn.id, c.name, 'uses');
    for (const v of vars.slice(0, 8)) if (new RegExp(`(?<![\\w$.])${escapeRe(v.name)}(?![\\w$])`).test(body)) addEdge(fn.id, v.name, 'uses');
  }
  return { nodes, edges };
}

/* -------------------------------------------------------------------------- */
/* Public entry                                                                */
/* -------------------------------------------------------------------------- */

export function analyzeSource(rawCode: string, language: Language): Review {
  const src = new Source(rawCode, language);
  const { fns, classes } = extractStructure(src);
  const categories = runRules(src, fns, classes);

  const names = Object.keys(categories) as CategoryName[];
  const weighted = names.reduce((s, k) => s + categories[k].score * WEIGHT[k], 0);
  const overallScore = Math.round(weighted / names.reduce((s, k) => s + WEIGHT[k], 0));
  const issues = names.reduce((s, k) => s + categories[k].findings.length, 0);

  const worst = names
    .filter((k) => categories[k].findings.length > 0)
    .sort((a, b) => categories[a].score - categories[b].score)[0];
  const LABEL: Record<CategoryName, string> = {
    codeStyle: 'code style',
    bestPractices: 'best practices',
    designPatterns: 'design patterns',
    possibleBugs: 'possible bugs',
    securityIssues: 'security',
    refactoring: 'refactoring',
  };

  const summary =
    issues === 0
      ? `[MOCK REVIEW] Offline pattern-based review (no AI model was called). No issues were detected. Score ${overallScore}/100.`
      : `[MOCK REVIEW] Offline pattern-based review (no AI model was called). ${issues} finding${issues === 1 ? '' : 's'} across ${
          names.filter((k) => categories[k].findings.length > 0).length
        } categories; the weakest area is ${LABEL[worst]} (${categories[worst].score}/100). Overall score ${overallScore}/100.`;

  return {
    overallScore,
    summary,
    categories,
    refactoredCode: buildRefactoredCode(src),
    documentation: buildDocumentation(src, fns, classes, { issues, score: overallScore }),
    unitTestStubs: buildTestStubs(src, fns, classes),
    structure: buildStructure(src, fns, classes),
  };
}
