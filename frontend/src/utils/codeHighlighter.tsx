import type { ReactNode } from "react";

interface Token {
  text: string;
  color?: string;
  italic?: boolean;
}

export function highlightCodeLine(line: string): ReactNode[] {
  if (!line) return [" "];

  const tokens: Token[] = [];
  // Tokenizer pattern matching comments, strings, numbers, booleans, keywords, types, function calls, identifiers, symbols
  const regex =
    /(\/\/[^\n]*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b\d+(?:\.\d+)?\b)|(\b(?:true|false|null|undefined)\b)|(\b(?:const|let|var|function|return|if|else|import|export|from|class|extends|async|await|new|typeof|switch|case|break|default|try|catch|finally|throw|while|for|of|in|interface|type)\b)|(\b(?:string|number|boolean|any|void|never|unknown|object|Symbol|Array|Record|Promise)\b)|(\b[a-zA-Z_$][a-zA-Z0-9_$]*(?=\s*\())|(\b[a-zA-Z_$][a-zA-Z0-9_$]*\b)|([^\s\w]+)|(\s+)/g;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(line)) !== null) {
    const [full, comment, str, num, boolNull, keyword, typeName, fnCall, ident] = match;

    if (comment) {
      tokens.push({ text: full, color: "#6A9955", italic: true });
    } else if (str) {
      tokens.push({ text: full, color: "#CE9178" });
    } else if (num) {
      tokens.push({ text: full, color: "#B5CEA8" });
    } else if (boolNull) {
      tokens.push({ text: full, color: "#569CD6" });
    } else if (keyword) {
      tokens.push({ text: full, color: "#C586C0" });
    } else if (typeName) {
      tokens.push({ text: full, color: "#4EC9B0" });
    } else if (fnCall) {
      tokens.push({ text: full, color: "#DCDCAA" });
    } else if (ident) {
      tokens.push({ text: full, color: "#9CDCFE" });
    } else {
      tokens.push({ text: full, color: "#D4D4D4" });
    }
  }

  if (tokens.length === 0) return [line];

  return tokens.map((t, idx) => (
    <span
      key={idx}
      style={{
        color: t.color,
        fontStyle: t.italic ? "italic" : "normal",
      }}
    >
      {t.text}
    </span>
  ));
}
