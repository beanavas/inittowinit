from typing import Dict, List

from app.models.access_graph import (
    AccessGraphEdge,
    AccessGraphEdgeData,
    CollaborationSignal,
    GraphEdgeType,
    SponsorCandidate,
)
from app.models.user import User


REPORTS_TO_VISUAL = {
    "stroke": "#8a8f98",
    "strokeWidth": "1.5",
    "lineStyle": "solid",
    "markerEnd": "arrow",
}
COLLABORATES_WITH_VISUAL = {
    "stroke": "#9ca3af",
    "strokeWidth": "1.5",
    "lineStyle": "dashed",
}
ACCESS_PATH_VISUAL = {
    "stroke": "#d97706",
    "strokeWidth": "4",
    "lineStyle": "solid",
    "markerEnd": "arrow",
}


def build_reports_to_edges(users: List[User]) -> List[AccessGraphEdge]:
    by_name = {u.name: u for u in users}
    edges: List[AccessGraphEdge] = []

    for user in users:
        manager = by_name.get(user.manager)
        if not manager:
            continue
        edges.append(
            AccessGraphEdge(
                id=f"reports-{user.employeeId}-{manager.employeeId}",
                source=user.employeeId,
                target=manager.employeeId,
                data=AccessGraphEdgeData(
                    edgeType=GraphEdgeType.REPORTS_TO,
                    label="Reports to",
                    visual=REPORTS_TO_VISUAL,
                ),
            )
        )
    return edges


def build_collaboration_edges(collaborations: List[CollaborationSignal]) -> List[AccessGraphEdge]:
    return [
        AccessGraphEdge(
            id=f"collab-{item.sourceEmployeeId}-{item.targetEmployeeId}",
            source=item.sourceEmployeeId,
            target=item.targetEmployeeId,
            type="straight",
            data=AccessGraphEdgeData(
                edgeType=GraphEdgeType.COLLABORATES_WITH,
                label="Collaborates with",
                reason=item.reason,
                visual={
                    **COLLABORATES_WITH_VISUAL,
                    "strength": str(item.strength),
                },
            ),
        )
        for item in collaborations
    ]


def build_access_path_edges(
    requester: User,
    users: List[User],
    top_sponsor: SponsorCandidate,
) -> List[AccessGraphEdge]:
    by_id: Dict[str, User] = {u.employeeId: u for u in users}
    by_name: Dict[str, User] = {u.name: u for u in users}
    sponsor = by_id[top_sponsor.employeeId]

    if sponsor.manager == requester.name or requester.manager == sponsor.name:
        path = [requester.employeeId, sponsor.employeeId]
    elif requester.manager:
        manager = by_name.get(requester.manager)
        path = [requester.employeeId, manager.employeeId, sponsor.employeeId] if manager else [requester.employeeId, sponsor.employeeId]
    else:
        path = [requester.employeeId, sponsor.employeeId]

    edges: List[AccessGraphEdge] = []
    for index in range(len(path) - 1):
        edges.append(
            AccessGraphEdge(
                id=f"access-path-{path[index]}-{path[index + 1]}",
                source=path[index],
                target=path[index + 1],
                animated=True,
                data=AccessGraphEdgeData(
                    edgeType=GraphEdgeType.ACCESS_PATH,
                    label="Recommended access path",
                    reason=f"Route to {top_sponsor.name}, relevance {top_sponsor.relevanceScore}",
                    visual=ACCESS_PATH_VISUAL,
                ),
            )
        )
    return edges
