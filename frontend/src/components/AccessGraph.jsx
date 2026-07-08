import { useEffect, useMemo, useRef, useState } from "react";
import EmployeeNode from "./EmployeeNode";

const VIEWBOX = { width: 760, height: 620 };
const CENTER = { x: VIEWBOX.width / 2, y: VIEWBOX.height / 2 };
const MIN_ZOOM = 0.7;
const MAX_ZOOM = 2.2;

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
    midX: source.x + dx * 0.5,
    midY: source.y + dy * 0.5,
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
  const selectedSponsor = selectedNode ? sponsorById[selectedNode.id] : null;

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

        {selectedNode && (
          <div className="graph-detail-panel">
            <div className="graph-detail-kicker">
              {selectedNode.data.isCurrentUser ? "Current requester" : "Selected employee"}
            </div>
            <div className="graph-detail-title">{selectedNode.data.isCurrentUser ? "You" : selectedNode.data.name}</div>
            <div className="graph-detail-subtitle">
              {selectedNode.data.role} · {selectedNode.data.team}
            </div>
            <div className="graph-detail-row">
              <span>Status</span>
              <strong>{selectedNode.data.accessStatus}</strong>
            </div>
            <div className="graph-detail-row">
              <span>Relevance</span>
              <strong>{selectedNode.data.relevanceScore}</strong>
            </div>
            <div className="graph-detail-row">
              <span>Hop distance</span>
              <strong>{selectedNode.data.hopDistance}</strong>
            </div>
            {selectedSponsor?.scoreBreakdown && (
              <div className="score-breakdown-mini">
                {Object.entries(selectedSponsor.scoreBreakdown).map(([key, value]) => (
                  <div key={key}>
                    <span>{key.replace(/([A-Z])/g, " $1")}</span>
                    <meter min="0" max="1" value={value} />
                  </div>
                ))}
              </div>
            )}
            {selectedSponsor?.reasons?.length > 0 && (
              <div className="graph-detail-reasons">
                {selectedSponsor.reasons.slice(0, 3).map((reason) => (
                  <div key={reason}>{reason}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
