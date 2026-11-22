import type { CodeEdge, CodeNode } from "../../types";

interface Props {
  nodes: CodeNode[];
  edges: CodeEdge[];
}

const W = 640;
const H = 420;
const R = 22;

const COLORS: Record<CodeNode["type"], string> = {
  function: "#8B5CF6",
  class: "#22D3EE",
  variable: "#F59E0B",
};

export default function CodeStructureGraph({ nodes, edges }: Props) {
  if (nodes.length === 0) {
    return <p className="mb-0">No structure detected.</p>;
  }

  const cx = W / 2;
  const cy = H / 2;
  const radius = Math.min(W, H) / 2 - 70;

  const positions = new Map<string, { x: number; y: number }>();
  nodes.forEach((n, i) => {
    if (i === 0) {
      positions.set(n.id, { x: cx, y: cy });
      return;
    }
    const angle = (2 * Math.PI * (i - 1)) / (nodes.length - 1) - Math.PI / 2;
    positions.set(n.id, {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  });

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-100"
        role="img"
        aria-label="Code structure graph"
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#9CA3AF" />
          </marker>
        </defs>

        {edges.map((e, i) => {
          const a = positions.get(e.from);
          const b = positions.get(e.to);
          if (!a || !b) return null;

          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const len = Math.hypot(dx, dy) || 1;

          return (
            <line
              key={`${e.from}-${e.to}-${i}`}
              className="graph-edge"
              style={{ animationDelay: `${i * 80}ms` }}
              x1={a.x + (dx / len) * R}
              y1={a.y + (dy / len) * R}
              x2={b.x - (dx / len) * (R + 4)}
              y2={b.y - (dy / len) * (R + 4)}
              stroke="#9CA3AF"
              strokeWidth={1.5}
              markerEnd="url(#arrow)"
            />
          );
        })}

        {nodes.map((n, i) => {
          const p = positions.get(n.id);
          if (!p) return null;
          const label = n.name.length > 14 ? n.name.slice(0, 13) + "…" : n.name;

          return (
            <g
              key={n.id}
              className="graph-node"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <circle cx={p.x} cy={p.y} r={R} fill={COLORS[n.type]} />
              <text
                x={p.x}
                y={p.y + R + 16}
                textAnchor="middle"
                fill="#E5E7EB"
                fontSize={12}
              >
                {label}
              </text>
              <title>
                {n.name} ({n.type})
              </title>
            </g>
          );
        })}
      </svg>

      <div className="d-flex gap-3 justify-content-center mt-2 small">
        {(Object.keys(COLORS) as CodeNode["type"][]).map((type) => (
          <span key={type}>
            <span
              className="d-inline-block rounded-circle me-1"
              style={{ width: 10, height: 10, backgroundColor: COLORS[type] }}
            />
            {type}
          </span>
        ))}
      </div>
    </div>
  );
}