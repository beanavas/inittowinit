import { useEffect, useMemo, useRef, useState } from "react";
import EmployeeNode from "./EmployeeNode";

const VIEWBOX = { width: 820, height: 740 };
const CENTER = { x: VIEWBOX.width / 2, y: VIEWBOX.height / 2 };
const MIN_ZOOM = 0.7;
const MAX_ZOOM = 2.2;
const TWO_PI = Math.PI * 2;

function ringRadius(hop) {
  if (hop <= 1) return 122;
  if (hop === 2) return 195;
  if (hop === 3) return 258;
  if (hop === 4) return 306;
  return 338;
}

function normalizeEdgeType(edge) {
  const edgeType = edge.data?.edgeType;
  if (edgeType === "reports_to") return "reports_to";
  if (edgeType === "collaborates_with" || edgeType === "works_with") {
    return "collaborates_with";
  }
  return null;
}

function edgeStyle(edgeType) {
  if (edgeType === "best_match") {
    return {
      className: "static-edge static-edge-best-match",
      markerEnd: "url(#best-match-arrow)",
      label: null,
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

function edgeLine(edge, layoutById) {
  const sourceNode = layoutById[edge.source];
  const targetNode = layoutById[edge.target];
  if (!sourceNode || !targetNode) return null;

  const source = sourceNode.screenPosition;
  const target = targetNode.screenPosition;

  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy) || 1;
  const sourcePad = sourceNode.avatarRadius + 3;
  const targetPad = targetNode.avatarRadius + 3;

  return {
    x1: source.x + (dx / length) * sourcePad,
    y1: source.y + (dy / length) * sourcePad,
    x2: target.x - (dx / length) * targetPad,
    y2: target.y - (dy / length) * targetPad,
    source,
    target,
    sourceHop: sourceNode.hopDistance,
    targetHop: targetNode.hopDistance,
  };
}

function edgePath(line) {
  const { x1, y1, x2, y2 } = line;

  return {
    d: `M ${x1} ${y1} L ${x2} ${y2}`,
    labelPoint: { x: (x1 + x2) * 0.5 + 10, y: (y1 + y2) * 0.5 - 8 },
  };
}

function hasAccessGroupInfo(node) {
  return node.data.isCurrentUser || (node.data.memberships?.length || 0) > 0;
}

function originalAngle(node) {
  return Math.atan2(node.position?.y || 0, node.position?.x || 0.001);
}

function nodeSortValue(node, sponsorById) {
  const sponsor = sponsorById[node.id];
  const sponsorBoost = sponsor?.isStrongSponsor || node.data.isStrongSponsor ? -1000 : 0;
  const relevance = Number(node.data.relevanceScore || 0);
  return sponsorBoost - relevance;
}

function calculateScreenLayout(rawNodes, sponsorById, accessPath) {
  const current = rawNodes.find((node) => node.data.isCurrentUser);
  const topSponsorId = accessPath?.[1];
  const byHop = rawNodes.reduce((groups, node) => {
    if (node.data.isCurrentUser) return groups;
    const hop = node.data.hopDistance || 1;
    if (!groups.has(hop)) groups.set(hop, []);
    groups.get(hop).push(node);
    return groups;
  }, new Map());

  const positioned = [];
  if (current) {
    positioned.push({
      ...current,
      screenPosition: CENTER,
      angle: 0,
      labelPlacement: "bottom",
    });
  }

  [...byHop.entries()]
    .sort(([a], [b]) => a - b)
    .forEach(([hop, hopNodes]) => {
      const sorted = [...hopNodes].sort((a, b) => {
        const priority = nodeSortValue(a, sponsorById) - nodeSortValue(b, sponsorById);
        if (priority !== 0) return priority;
        return originalAngle(a) - originalAngle(b);
      });

      const count = sorted.length;
      const step = TWO_PI / Math.max(count, 1);
      const ringOffset = -Math.PI / 2 + (hop - 1) * 0.34 + (count % 2 === 0 ? step / 2 : 0);
      const topSponsorIndex = sorted.findIndex((node) => node.id === topSponsorId);
      const sponsorRotation = topSponsorIndex >= 0
        ? -Math.PI / 2 - (ringOffset + topSponsorIndex * step)
        : 0;

      sorted.forEach((node, index) => {
        const angle = ringOffset + sponsorRotation + index * step;
        const crowdedRingOffset = count > 8 && index % 2 === 1 ? 14 : 0;
        const radius = ringRadius(hop) + crowdedRingOffset;

        positioned.push({
          ...node,
          screenPosition: {
            x: CENTER.x + Math.cos(angle) * radius,
            y: CENTER.y + Math.sin(angle) * radius,
          },
          angle,
          labelPlacement: Math.sin(angle) < -0.18 ? "top" : "bottom",
        });
      });
    });

  return positioned;
}

export default function AccessGraph({ graph, onNodeSelect, defaultHopFilter = "all" }) {
  const [hopFilter, setHopFilter] = useState(defaultHopFilter);
  const [selectedId, setSelectedId] = useState(graph.requesterEmployeeId);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [worldSize, setWorldSize] = useState({ width: VIEWBOX.width, height: VIEWBOX.height });
  const graphWrapRef = useRef(null);
  const graphViewportRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => {
    setSelectedId(graph.requesterEmployeeId);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setHopFilter(defaultHopFilter);
  }, [graph.requesterEmployeeId, graph.technology, defaultHopFilter]);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(document.fullscreenElement === graphWrapRef.current);
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    const viewport = graphViewportRef.current;
    if (!viewport) return undefined;

    function fitWorld() {
      const { width, height } = viewport.getBoundingClientRect();
      if (!width || !height) return;
      const scale = Math.min(width / VIEWBOX.width, height / VIEWBOX.height);
      setWorldSize({
        width: VIEWBOX.width * scale,
        height: VIEWBOX.height * scale,
      });
    }

    fitWorld();
    const resizeObserver = new ResizeObserver(fitWorld);
    resizeObserver.observe(viewport);
    return () => resizeObserver.disconnect();
  }, []);

  const sponsorById = useMemo(
    () => Object.fromEntries(graph.sponsorRanking.map((sponsor) => [sponsor.employeeId, sponsor])),
    [graph.sponsorRanking]
  );

  const eligibleNodes = useMemo(
    () => graph.nodes.filter(hasAccessGroupInfo),
    [graph.nodes]
  );

  const maxHop = useMemo(
    () => Math.max(1, ...eligibleNodes.map((node) => node.data.hopDistance || 0)),
    [eligibleNodes]
  );

  const visibleHop = hopFilter === "all" ? maxHop : Number(hopFilter);

  const { nodes, edges, rings, layoutById, hiddenCount } = useMemo(() => {
    const visibleRawNodes = eligibleNodes.filter(
      (node) => node.data.isCurrentUser || node.data.hopDistance <= visibleHop
    );

    const visibleIds = new Set(visibleRawNodes.map((node) => node.id));

    const positionedNodes = calculateScreenLayout(visibleRawNodes, sponsorById, graph.accessPath).map((node) => ({
      ...node,
      sponsor: sponsorById[node.id],
      avatarRadius: node.data.isCurrentUser ? 27 : 20,
      hopDistance: node.data.hopDistance || 0,
    }));

    const byId = Object.fromEntries(
      positionedNodes.map((node) => [node.id, {
        screenPosition: node.screenPosition,
        avatarRadius: node.avatarRadius,
        hopDistance: node.hopDistance,
      }])
    );

    const hopRings = [...new Set(visibleRawNodes.map((node) => node.data.hopDistance).filter(Boolean))]
      .sort((a, b) => a - b)
      .map((hop) => ({
        hop,
        radius: ringRadius(hop),
        label: hop === 1 ? "1 hop" : `${hop} hops`,
      }));

    const relationshipEdges = graph.edges
      .filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target))
      .map((edge) => ({
        ...edge,
        visualType: normalizeEdgeType(edge),
      }))
      .filter((edge) => edge.visualType);

    const directPairs = new Set(
      relationshipEdges.map((edge) => [edge.source, edge.target].sort().join("::"))
    );
    const directHopEdges = visibleRawNodes
      .filter((node) => node.id !== graph.requesterEmployeeId)
      .filter((node) => node.data.hopDistance === 1)
      .filter((node) => !directPairs.has([graph.requesterEmployeeId, node.id].sort().join("::")))
      .map((node) => ({
        id: `direct-hop-${graph.requesterEmployeeId}-${node.id}`,
        source: graph.requesterEmployeeId,
        target: node.id,
        data: { edgeType: "direct_hop" },
        visualType: "collaborates_with",
      }));

    const topVisibleSponsor = graph.sponsorRanking.find((sponsor) => (
      sponsor.employeeId !== graph.requesterEmployeeId && visibleIds.has(sponsor.employeeId)
    ));
    const bestMatchEdge = topVisibleSponsor
      ? [{
          id: `best-match-${graph.requesterEmployeeId}-${topVisibleSponsor.employeeId}`,
          source: graph.requesterEmployeeId,
          target: topVisibleSponsor.employeeId,
          data: { edgeType: "best_match" },
          visualType: "best_match",
        }]
      : [];

    const allEdges = [...relationshipEdges, ...directHopEdges, ...bestMatchEdge]
      .sort((a, b) => {
        const order = { collaborates_with: 0, reports_to: 1, best_match: 2 };
        return order[a.visualType] - order[b.visualType];
      });

    return {
      nodes: positionedNodes,
      edges: allEdges,
      rings: hopRings,
      layoutById: byId,
      hiddenCount: eligibleNodes.length - visibleRawNodes.length,
    };
  }, [eligibleNodes, graph, sponsorById, visibleHop]);

  const selectedNode = nodes.find((node) => node.id === selectedId) || nodes.find((node) => node.data.isCurrentUser);

  function resetView() {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }

  async function toggleFullscreen() {
    const wrap = graphWrapRef.current;
    if (!wrap) return;

    try {
      if (document.fullscreenElement === wrap) {
        await document.exitFullscreen();
      } else {
        await wrap.requestFullscreen();
      }
    } catch {
      setIsFullscreen((current) => !current);
    }
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
    <div className={`access-graph-wrap${isFullscreen ? " graph-fullscreen" : ""}`} ref={graphWrapRef}>
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
          <button
            className="graph-icon-button"
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? (
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M9 4v5H4" />
                <path d="M15 4v5h5" />
                <path d="M9 20v-5H4" />
                <path d="M15 20v-5h5" />
              </svg>
            ) : (
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M4 9V4h5" />
                <path d="M20 9V4h-5" />
                <path d="M4 15v5h5" />
                <path d="M20 15v5h-5" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div
        className="static-access-graph"
        ref={graphViewportRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          className="static-graph-world"
          style={{
            width: `${worldSize.width}px`,
            height: `${worldSize.height}px`,
            transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
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
              <marker id="best-match-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
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
              const line = edgeLine(edge, layoutById);
              if (!line) return null;
              const visual = edgeStyle(edge.visualType);
              const path = edgePath(line);
              return (
                <g key={edge.id}>
                  <path
                    className={visual.className}
                    d={path.d}
                    markerEnd={visual.markerEnd}
                    vectorEffect="non-scaling-stroke"
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
                  onNodeSelect?.(node);
                }}
              >
                <EmployeeNode data={node.data} labelPlacement={node.labelPlacement} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
