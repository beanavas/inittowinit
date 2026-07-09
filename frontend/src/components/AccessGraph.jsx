import { useEffect, useMemo, useRef, useState } from "react";
import EmployeeNode from "./EmployeeNode";

const VIEWBOX = { width: 760, height: 620 };
const CENTER = { x: VIEWBOX.width / 2, y: VIEWBOX.height / 2 };
const MIN_ZOOM = 0.7;
const MAX_ZOOM = 2.2;

function ringRadius(hop) {
  if (hop <= 1) return 175;
  if (hop === 2) return 290;
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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
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
    source,
    target,
  };
}

function pointOnQuadratic(x1, y1, cx, cy, x2, y2, t) {
  const oneMinusT = 1 - t;
  const x = oneMinusT * oneMinusT * x1 + 2 * oneMinusT * t * cx + t * t * x2;
  const y = oneMinusT * oneMinusT * y1 + 2 * oneMinusT * t * cy + t * t * y2;
  return { x, y };
}

function edgeTier(line, visualType) {
  if (visualType === "access_path") return 0;

  const sourceDist = Math.hypot(line.source.x - CENTER.x, line.source.y - CENTER.y);
  const targetDist = Math.hypot(line.target.x - CENTER.x, line.target.y - CENTER.y);
  const avgDist = (sourceDist + targetDist) * 0.5;

  // Tier 1: local edges (mostly inside 1 hop ring)
  // Tier 2: mixed/local-to-mid edges
  // Tier 3: longer cross-ring edges
  if (avgDist < 210) return 1;
  if (avgDist < 275) return 2;
  return 3;
}

function tierBend(visualType, tier) {
  const table = {
    reports_to: { 1: 58, 2: 86, 3: 118 },
    collaborates_with: { 1: 38, 2: 58, 3: 84 },
  };
  return table[visualType]?.[tier] || 56;
}

function edgePath(line, visualType) {
  const { x1, y1, x2, y2 } = line;

  if (visualType === "access_path") {
    return {
      d: `M ${x1} ${y1} L ${x2} ${y2}`,
      labelPoint: { x: (x1 + x2) * 0.5 + 10, y: (y1 + y2) * 0.5 - 8 },
    };
  }

  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy) || 1;
  const midX = (x1 + x2) * 0.5;
  const midY = (y1 + y2) * 0.5;

  // Perpendicular normal used to bend edges away from dense center area.
  const nx = -dy / length;
  const ny = dx / length;
  const dotToCenter = (midX - CENTER.x) * nx + (midY - CENTER.y) * ny;
  const direction = dotToCenter >= 0 ? 1 : -1;
  const tier = edgeTier(line, visualType);
  const bend = tierBend(visualType, tier);

  const cx = midX + nx * bend * direction;
  const cy = midY + ny * bend * direction;
  const labelPoint = pointOnQuadratic(x1, y1, cx, cy, x2, y2, 0.5);

  return {
    d: `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`,
    labelPoint: { x: labelPoint.x + 10, y: labelPoint.y - 8 },
  };
}

export default function AccessGraph({ graph }) {
  const [hopFilter, setHopFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(graph.requesterEmployeeId);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);

  useEffect(() => {
    setSelectedId(graph.requesterEmployeeId);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setHopFilter("all");
  }, [graph.requesterEmployeeId, graph.technology]);

  const sponsorById = useMemo(
    () => Object.fromEntries(graph.sponsorRanking.map((sponsor) => [sponsor.employeeId, sponsor])),
    [graph.sponsorRanking]
  );

  const maxHop = useMemo(
    () => Math.max(1, ...graph.nodes.map((node) => node.data.hopDistance || 0)),
    [graph.nodes]
  );

  const visibleHop = hopFilter === "all" ? maxHop : Number(hopFilter);

  const { nodes, edges, rings, positionById, hiddenCount } = useMemo(() => {
    const visibleRawNodes = graph.nodes.filter(
      (node) => node.data.isCurrentUser || node.data.hopDistance <= visibleHop
    );

    const visibleIds = new Set(visibleRawNodes.map((node) => node.id));

    const positionedNodes = visibleRawNodes.map((node) => ({
      ...node,
      screenPosition: nodeScreenPosition(node),
      sponsor: sponsorById[node.id],
    }));

    const positions = Object.fromEntries(
      positionedNodes.map((node) => [node.id, node.screenPosition])
    );

    const hopRings = [...new Set(visibleRawNodes.map((node) => node.data.hopDistance).filter(Boolean))]
      .sort((a, b) => a - b)
      .map((hop) => ({
        hop,
        radius: ringRadius(hop),
        label: hop === 1 ? "1 hop" : `${hop} hops`,
      }));

    const allEdges = [...graph.edges, ...accessPathEdges(graph)]
      .filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target))
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
      hiddenCount: graph.nodes.length - visibleRawNodes.length,
    };
  }, [graph, sponsorById, visibleHop]);

  const selectedNode = nodes.find((node) => node.id === selectedId) || nodes.find((node) => node.data.isCurrentUser);
  function resetView() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  function handleWheel(event) {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.08 : 0.08;
    setZoom((current) => clamp(Number((current + delta).toFixed(2)), MIN_ZOOM, MAX_ZOOM));
  }

  function handlePointerDown(event) {
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      pan,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPan({
      x: drag.pan.x + event.clientX - drag.startX,
      y: drag.pan.y + event.clientY - drag.startY,
    });
  }

  function handlePointerUp(event) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  const hopOptions = Array.from({ length: maxHop }, (_, index) => index + 1);

  return (
    <div className="access-graph-wrap">
      <div className="graph-toolbar">
        <div className="graph-toolbar-left">
          <span className="graph-toolbar-label">Visible hops</span>
          <div className="hop-filter" aria-label="Visible hops">
            {hopOptions.map((hop) => (
              <button
                className={hopFilter === String(hop) ? "active" : ""}
                key={hop}
                type="button"
                onClick={() => setHopFilter(String(hop))}
              >
                {hop}
              </button>
            ))}
            <button
              className={hopFilter === "all" ? "active" : ""}
              type="button"
              onClick={() => setHopFilter("all")}
            >
              All
            </button>
          </div>
          {hiddenCount > 0 && <span className="graph-hidden-count">+{hiddenCount} hidden</span>}
        </div>
        <div className="graph-toolbar-right">
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={resetView}>Reset view</button>
        </div>
      </div>

      <div
        className="static-access-graph"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          className="static-graph-world"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          <svg
            className="static-graph-svg"
            viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
            role="img"
            aria-label={`${graph.technology} access support graph`}
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
              const path = edgePath(line, edge.visualType);
              return (
                <g key={edge.id}>
                  <path
                    className={visual.className}
                    d={path.d}
                    markerEnd={visual.markerEnd}
                  />
                  {visual.label && (
                    <text className="static-edge-label" x={path.labelPoint.x} y={path.labelPoint.y}>
                      {visual.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          <div className="static-node-layer">
            {nodes.map((node) => (
              <button
                className={`static-node-position${selectedNode?.id === node.id ? " selected" : ""}`}
                key={node.id}
                style={{
                  left: `${(node.screenPosition.x / VIEWBOX.width) * 100}%`,
                  top: `${(node.screenPosition.y / VIEWBOX.height) * 100}%`,
                }}
                title={`${node.data.name}: ${node.data.accessStatus}, ${node.data.relevanceScore} match`}
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelectedId(node.id);
                }}
              >
                <EmployeeNode data={node.data} />
              </button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
