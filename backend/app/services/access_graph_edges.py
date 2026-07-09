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

REPORTS_TO_VISUAL = {"stroke": "#7b8794", "strokeWidth": "2", "lineStyle": "solid", "markerEnd": "arrow"}
TEAM_VISUAL = {"stroke": "#007bc3", "strokeWidth": "2", "lineStyle": "solid"}
WORKS_WITH_VISUAL = {"stroke": "#94a3b3", "strokeWidth": "1.5", "lineStyle": "dashed"}
COLLABORATION_STRENGTH_THRESHOLD = 0.7

EDGE_LABELS = {
    GraphEdgeType.REPORTS_TO: "Reports to",
    GraphEdgeType.TEAM: "Team",
    GraphEdgeType.WORKS_WITH: "Works with",
}

EDGE_VISUALS = {
    GraphEdgeType.REPORTS_TO: REPORTS_TO_VISUAL,
    GraphEdgeType.TEAM: TEAM_VISUAL,
    GraphEdgeType.WORKS_WITH: WORKS_WITH_VISUAL,
}

EDGE_REASONS = {
    GraphEdgeType.REPORTS_TO: "Formal manager/reporting relationship in the org chart.",
    GraphEdgeType.TEAM: "Same team or immediate working group.",
    GraphEdgeType.WORKS_WITH: "Direct collaboration signal from shared projects, meetings, or files.",
}


def _uses_technology(employee_id: str, technology: str, usage: List[UsageSignal]) -> bool:
    """True if the employee has any access (provisioned/pending) or logged usage for this tool."""
    status, _, _ = get_access_status(employee_id, technology, usage)
    return status != GraphAccessStatus.NO_ACCESS


def _collaborates(a_id: str, b_id: str, collaborations: List[CollaborationSignal]) -> bool:
    return any(
        {c.sourceEmployeeId, c.targetEmployeeId} == {a_id, b_id}
        and c.strength >= COLLABORATION_STRENGTH_THRESHOLD
        for c in collaborations
    )


def _reports_to(a: User, b: User) -> bool:
    a_reports_to_b = a.manager == b.name and "intern" not in b.role.lower()
    b_reports_to_a = b.manager == a.name and "intern" not in a.role.lower()
    return a_reports_to_b or b_reports_to_a


def classify_edge(
    a: User,
    b: User,
    technology: str,
    usage: List[UsageSignal],
    collaborations: List[CollaborationSignal],
    allowed_report_pairs: Optional[Set[frozenset[str]]] = None,
) -> Optional[GraphEdgeType]:
    """
    Classify the relationship between two people into one drawable relation, by
    priority: the requester's explicit org chain, shared team membership, or a
    direct collaboration where both people use the selected technology. Team
    membership is checked before ad-hoc collaboration so two teammates are
    shown as teammates rather than via a manufactured "works with" story.
    """
    report_pair = frozenset({a.employeeId, b.employeeId})
    if _reports_to(a, b) and (allowed_report_pairs is None or report_pair in allowed_report_pairs):
        return GraphEdgeType.REPORTS_TO
    if a.teams() & b.teams():
        return GraphEdgeType.TEAM
    if (
        _collaborates(a.employeeId, b.employeeId, collaborations)
        and _uses_technology(a.employeeId, technology, usage)
        and _uses_technology(b.employeeId, technology, usage)
    ):
        return GraphEdgeType.WORKS_WITH
    return None


def build_relationship_graph(
    users: List[User],
    technology: str,
    usage: List[UsageSignal],
    collaborations: List[CollaborationSignal],
    allowed_report_pairs: Optional[Set[frozenset[str]]] = None,
) -> Dict[str, Set[str]]:
    """Undirected adjacency built from scoped org edges and qualified collaboration edges."""
    graph: Dict[str, Set[str]] = {u.employeeId: set() for u in users}
    for i, a in enumerate(users):
        for b in users[i + 1 :]:
            if classify_edge(a, b, technology, usage, collaborations, allowed_report_pairs):
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

    return distances


_EDGE_PRIORITY = {
    GraphEdgeType.REPORTS_TO: 0,
    GraphEdgeType.TEAM: 1,
    GraphEdgeType.WORKS_WITH: 2,
}


def build_relationship_edges(
    users: List[User],
    technology: str,
    usage: List[UsageSignal],
    collaborations: List[CollaborationSignal],
    requester_id: str,
    hop_distances: Dict[str, int],
    graph: Dict[str, Set[str]],
    allowed_report_pairs: Optional[Set[frozenset[str]]] = None,
) -> List[AccessGraphEdge]:
    """
    Draw a single shortest-path tree rooted at the requester instead of every
    qualifying pairwise relation. Each person gets exactly one edge to an
    already-closer org or collaboration connection, so the graph reads as "how
    do I get to this person" rather than "everyone related to everyone."
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
            edge_type = classify_edge(user, neighbor, technology, usage, collaborations, allowed_report_pairs)
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
