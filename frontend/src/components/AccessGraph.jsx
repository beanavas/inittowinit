import { useMemo } from "react";
import EmployeeNode from "./EmployeeNode";

const VIEWBOX = { width: 760, height: 620 };
const CENTER = { x: VIEWBOX.width / 2, y: VIEWBOX.height / 2 };

function ringRadius(hop) {
  if (hop <= 1) return 185;
  if (hop === 2) return 268;
  return 310;
}

function normalizeEdgeType(edge) {
  const edgeType = edge.data?.edgeType;
  if (edgeType === "access_path") return "access_path";
  if (edgeType === "reports_to" || edgeType === "team") return "reports_to";
  if (edgeType === "collaborates_with" || edgeType === "works_with" || edgeType === "tool") {
    return "collaborates_with";
  }
  return "collaborates_with";
}

function edgeStyle(edgeType) {
  if (edgeType === "access_path") {
    return {
      className: "static-edge static-edge-access-path",
      markerEnd: "url(#access-arrow)",
      label: "Access Path",
    };
  }
  if (edgeType === "reports_to") {
    return {
      className: "static-edge static-edge-reports",
      markerEnd: "url(#reports-arrow)",
      label: null,
    };
  }
  return {
    className: "static-edge static-edge-collaborates",
    markerEnd: null,
    label: null,
  };
}

function nodeScreenPosition(node) {
  if (node.data.isCurrentUser) return CENTER;

  const angle = Math.atan2(node.position.y, node.position.x || 0.001);
  const radius = ringRadius(node.data.hopDistance || 1);

  return {
    x: CENTER.x + Math.cos(angle) * radius,
    y: CENTER.y + Math.sin(angle) * radius,
  };
}

function accessPathEdges(graph) {
  if (!graph.accessPath || graph.accessPath.length < 2) return [];
  if (graph.edges.some((edge) => edge.data?.edgeType === "access_path")) return [];

  return graph.accessPath.slice(0, -1).map((source, index) => ({
    id: `access-path-${source}-${graph.accessPath[index + 1]}`,
    source,
    target: graph.accessPath[index + 1],
    data: { edgeType: "access_path" },
  }));
}

function edgeLine(edge, positionById) {
  const source = positionById[edge.source];
  const target = positionById[edge.target];
  if (!source || !target) return null;

  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy) || 1;
  const sourcePad = edge.data?.edgeType === "access_path" ? 38 : 30;
  const targetPad = edge.data?.edgeType === "access_path" ? 38 : 30;

  return {
    x1: source.x + (dx / length) * sourcePad,
    y1: source.y + (dy / length) * sourcePad,
    x2: target.x - (dx / length) * targetPad,
    y2: target.y - (dy / length) * targetPad,
    midX: source.x + dx * 0.5,
    midY: source.y + dy * 0.5,
  };
}

export default function AccessGraph({ graph }) {
  const { nodes, edges, rings, positionById } = useMemo(() => {
    const positionedNodes = graph.nodes.map((node) => ({
      ...node,
      screenPosition: nodeScreenPosition(node),
    }));

    const positions = Object.fromEntries(
      positionedNodes.map((node) => [node.id, node.screenPosition])
    );

    const hopRings = [...new Set(graph.nodes.map((node) => node.data.hopDistance).filter(Boolean))]
      .sort((a, b) => a - b)
      .map((hop) => ({
        hop,
        radius: ringRadius(hop),
        label: hop === 1 ? "1 hop" : `${hop} hops`,
      }));

    const allEdges = [...graph.edges, ...accessPathEdges(graph)]
      .map((edge) => ({
        ...edge,
        visualType: normalizeEdgeType(edge),
      }))
      .sort((a, b) => {
        const order = { collaborates_with: 0, reports_to: 1, access_path: 2 };
        return order[a.visualType] - order[b.visualType];
      });

    return {
      nodes: positionedNodes,
      edges: allEdges,
      rings: hopRings,
      positionById: positions,
    };
  }, [graph]);

  return (
    <div className="access-graph-wrap">
      <div className="static-access-graph">
        <svg
          className="static-graph-svg"
          viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
          role="img"
          aria-label={`${graph.technology} access sponsor graph`}
        >
          <defs>
            <marker id="reports-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" />
            </marker>
            <marker id="access-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" />
            </marker>
          </defs>

          {rings.map((ring) => (
            <g key={ring.hop}>
              <circle className="static-hop-ring" cx={CENTER.x} cy={CENTER.y} r={ring.radius} />
              <text
                className="static-hop-label"
                x={CENTER.x + ring.radius * 0.68}
                y={CENTER.y - ring.radius * 0.72}
              >
                {ring.label}
              </text>
            </g>
          ))}

          {edges.map((edge) => {
            const line = edgeLine(edge, positionById);
            if (!line) return null;
            const visual = edgeStyle(edge.visualType);
            return (
              <g key={edge.id}>
                <line
                  className={visual.className}
                  x1={line.x1}
                  y1={line.y1}
                  x2={line.x2}
                  y2={line.y2}
                  markerEnd={visual.markerEnd}
                />
                {visual.label && (
                  <text className="static-edge-label" x={line.midX + 10} y={line.midY - 8}>
                    {visual.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        <div className="static-node-layer" aria-hidden="true">
          {nodes.map((node) => (
            <div
              className="static-node-position"
              key={node.id}
              style={{
                left: `${(node.screenPosition.x / VIEWBOX.width) * 100}%`,
                top: `${(node.screenPosition.y / VIEWBOX.height) * 100}%`,
              }}
            >
              <EmployeeNode data={node.data} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
