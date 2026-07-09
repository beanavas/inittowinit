from collections import deque
from typing import Dict, List, Optional, Set

from app.models.access_graph import (
    AccessGraphEdge,
    AccessGraphEdgeData,
    CollaborationSignal,
    GraphAccessStatus,
    GraphEdgeType,
    UsageSignal,
)
from app.models.user import User
from app.services.access_graph_scoring import get_access_status

TEAM_VISUAL = {"stroke": "#007bc3", "strokeWidth": "2", "lineStyle": "solid"}
TOOL_VISUAL = {"stroke": "#001f45", "strokeWidth": "2", "lineStyle": "dashed", "markerEnd": "arrow"}
WORKS_WITH_VISUAL = {"stroke": "#94a3b3", "strokeWidth": "1.5", "lineStyle": "dashed"}

EDGE_LABELS = {
    GraphEdgeType.TEAM: "Team",
    GraphEdgeType.TOOL: "Common tool",
    GraphEdgeType.WORKS_WITH: "Works with",
}

EDGE_VISUALS = {
    GraphEdgeType.TEAM: TEAM_VISUAL,
    GraphEdgeType.TOOL: TOOL_VISUAL,
    GraphEdgeType.WORKS_WITH: WORKS_WITH_VISUAL,
}

EDGE_REASONS = {
    GraphEdgeType.TEAM: "Same team or immediate working group.",
    GraphEdgeType.TOOL: "Both people have access to, pending access for, or usage history with the requested technology.",
    GraphEdgeType.WORKS_WITH: "Direct collaboration signal from shared projects, meetings, or files.",
}


def _uses_technology(employee_id: str, technology: str, usage: List[UsageSignal]) -> bool:
    """True if the employee has any access (provisioned/pending) or logged usage for this tool."""
    status, _, _ = get_access_status(employee_id, technology, usage)
    return status != GraphAccessStatus.NO_ACCESS


def _collaborates(a_id: str, b_id: str, collaborations: List[CollaborationSignal]) -> bool:
    return any({c.sourceEmployeeId, c.targetEmployeeId} == {a_id, b_id} for c in collaborations)


def classify_edge(
    a: User,
    b: User,
    technology: str,
    usage: List[UsageSignal],
    collaborations: List[CollaborationSignal],
) -> Optional[GraphEdgeType]:
    """
    Classify the relationship between two people into exactly one of the three
    relation types we draw, by priority: shared use of the requested tool (most
    relevant to "who can help me get this"), then shared team, then direct
    collaboration history.
    """
    if _uses_technology(a.employeeId, technology, usage) and _uses_technology(b.employeeId, technology, usage):
        return GraphEdgeType.TOOL
    if a.teams() & b.teams():
        return GraphEdgeType.TEAM
    if _collaborates(a.employeeId, b.employeeId, collaborations):
        return GraphEdgeType.WORKS_WITH
    return None


def build_relationship_graph(
    users: List[User],
    technology: str,
    usage: List[UsageSignal],
    collaborations: List[CollaborationSignal],
) -> Dict[str, Set[str]]:
    """Undirected adjacency built purely from the three relation types above."""
    graph: Dict[str, Set[str]] = {u.employeeId: set() for u in users}
    for i, a in enumerate(users):
        for b in users[i + 1 :]:
            if classify_edge(a, b, technology, usage, collaborations):
                graph[a.employeeId].add(b.employeeId)
                graph[b.employeeId].add(a.employeeId)
    return graph


def calculate_hop_distances(requester_id: str, graph: Dict[str, Set[str]]) -> Dict[str, int]:
    distances = {requester_id: 0}
    queue = deque([requester_id])
    while queue:
        current = queue.popleft()
        for neighbor in graph.get(current, set()):
            if neighbor not in distances:
                distances[neighbor] = distances[current] + 1
                queue.append(neighbor)

    fallback_distance = max(distances.values(), default=0) + 1
    return {node: distances.get(node, fallback_distance) for node in graph}


_EDGE_PRIORITY = {GraphEdgeType.TOOL: 0, GraphEdgeType.TEAM: 1, GraphEdgeType.WORKS_WITH: 2}


def build_relationship_edges(
    users: List[User],
    technology: str,
    usage: List[UsageSignal],
    collaborations: List[CollaborationSignal],
    requester_id: str,
    hop_distances: Dict[str, int],
    graph: Dict[str, Set[str]],
) -> List[AccessGraphEdge]:
    """
    Draw a single shortest-path tree rooted at the requester instead of every
    qualifying pairwise relation — a shared team or a popular tool would otherwise
    turn into a dense clique. Each person gets exactly one edge, to whichever
    already-closer connection is the most relevant reason they're reachable
    (tool usage > team > collaboration), so the graph reads as "how do I get to
    this person" rather than "everyone who is related to everyone."
    """
    by_id = {u.employeeId: u for u in users}
    edges: List[AccessGraphEdge] = []

    for user in users:
        if user.employeeId == requester_id:
            continue
        distance = hop_distances.get(user.employeeId)
        if not distance:
            continue

        candidates = []
        for neighbor_id in graph.get(user.employeeId, set()):
            neighbor = by_id.get(neighbor_id)
            if not neighbor or hop_distances.get(neighbor_id) != distance - 1:
                continue
            edge_type = classify_edge(user, neighbor, technology, usage, collaborations)
            if edge_type:
                candidates.append((edge_type, neighbor))
        if not candidates:
            continue

        candidates.sort(key=lambda c: (_EDGE_PRIORITY[c[0]], c[1].employeeId))
        edge_type, parent = candidates[0]

        edges.append(
            AccessGraphEdge(
                id=f"{edge_type.value}-{parent.employeeId}-{user.employeeId}",
                source=parent.employeeId,
                target=user.employeeId,
                type="straight",
                data=AccessGraphEdgeData(
                    edgeType=edge_type,
                    label=EDGE_LABELS[edge_type],
                    reason=EDGE_REASONS[edge_type],
                    visual=EDGE_VISUALS[edge_type],
                ),
            )
        )
    return edges
