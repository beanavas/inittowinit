import { useMemo } from "react";
import ReactFlow, { Controls, MarkerType } from "reactflow";
import "reactflow/dist/style.css";
import EmployeeNode from "./EmployeeNode";
import RingGuide from "./RingGuide";

const nodeTypes = { employee: EmployeeNode, ringGuide: RingGuide };
const HOP_RADIUS = 220; // must match backend's calculate_hop_ring_layout

export default function AccessGraph({ graph }) {
  const edges = useMemo(
    () =>
      graph.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: e.type,
        animated: e.animated,
        style: {
          stroke: e.data.visual?.stroke || "#94a3b3",
          strokeWidth: Number(e.data.visual?.strokeWidth) || 1.5,
          strokeDasharray: e.data.visual?.lineStyle === "dashed" ? "6 5" : undefined,
        },
        markerEnd: e.data.visual?.markerEnd === "arrow" ? { type: MarkerType.ArrowClosed, color: e.data.visual.stroke } : undefined,
      })),
    [graph.edges]
  );

  const nodes = useMemo(() => {
    const center = graph.nodes.find((n) => n.data.isCurrentUser)?.position || { x: 0, y: 0 };
    const hops = [...new Set(graph.nodes.map((n) => n.data.hopDistance).filter((h) => h > 0))].sort();

    const ringGuides = hops.map((hop) => {
      const radius = HOP_RADIUS * hop;
      return {
        id: `ring-${hop}`,
        type: "ringGuide",
        position: { x: center.x - radius, y: center.y - radius },
        data: { radius, label: hop === 1 ? "1 hop" : `${hop} hops` },
        draggable: false,
        selectable: false,
        connectable: false,
        zIndex: -1,
      };
    });

    return [...ringGuides, ...graph.nodes];
  }, [graph.nodes]);

  return (
    <div className="access-graph-wrap">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodeOrigin={[0.5, 0.5]}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        nodesDraggable
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
