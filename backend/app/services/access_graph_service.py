from typing import Dict, List

from app.models.access_graph import (
    AccessGraphNode,
    AccessGraphNodeData,
    AccessGraphResponse,
    GraphAccessStatus,
)
from app.services import user_service
from app.services.access_graph_edges import (
    build_access_path_edges,
    build_collaboration_edges,
    build_reports_to_edges,
)
from app.services.access_graph_layout import calculate_hop_ring_layout
from app.services.access_graph_scoring import (
    calculate_hop_distances,
    get_access_status,
    load_collaborations,
    load_usage_signals,
    rank_sponsors,
)


def _heat_color(score: float) -> str:
    if score >= 80:
        return "#b45309"
    if score >= 65:
        return "#d97706"
    if score >= 45:
        return "#f59e0b"
    if score >= 20:
        return "#94a3b8"
    return "#cbd5e1"


def _ring_color(status: GraphAccessStatus) -> str:
    return {
        GraphAccessStatus.USES_DAILY: "#16a34a",
        GraphAccessStatus.USES_WEEKLY: "#65a30d",
        GraphAccessStatus.HAS_ACCESS: "#2563eb",
        GraphAccessStatus.PENDING: "#ca8a04",
        GraphAccessStatus.NO_ACCESS: "#94a3b8",
    }[status]


def build_access_graph(employee_id: str, technology: str) -> AccessGraphResponse:
    requester = user_service.get_user(employee_id)
    if not requester:
        raise ValueError(f"User '{employee_id}' not found")

    users = user_service.get_all_users()
    collaborations = load_collaborations()
    usage = load_usage_signals()
    hop_distances = calculate_hop_distances(employee_id, users, collaborations)
    positions = calculate_hop_ring_layout(users, hop_distances, employee_id)
    sponsor_ranking = rank_sponsors(requester, users, technology, hop_distances, collaborations)
    ranking_by_id: Dict[str, object] = {s.employeeId: s for s in sponsor_ranking}

    nodes: List[AccessGraphNode] = []
    for user in users:
        sponsor = ranking_by_id.get(user.employeeId)
        status, intensity, usage_score = get_access_status(user.employeeId, technology, usage)
        relevance = sponsor.relevanceScore if sponsor else (100.0 if user.employeeId == employee_id else usage_score * 100)
        is_strong = bool(sponsor and sponsor.isStrongSponsor)

        nodes.append(
            AccessGraphNode(
                id=user.employeeId,
                position=positions[user.employeeId],
                data=AccessGraphNodeData(
                    employeeId=user.employeeId,
                    name=user.name,
                    role=user.role,
                    team=user.team,
                    department=user.department,
                    accessStatus=status,
                    usageIntensity=intensity,
                    relevanceScore=round(relevance, 1),
                    scoreBreakdown=sponsor.scoreBreakdown if sponsor else None,
                    isCurrentUser=user.employeeId == employee_id,
                    isStrongSponsor=is_strong,
                    hopDistance=hop_distances[user.employeeId],
                    visual={
                        "heatColor": "#111827" if user.employeeId == employee_id else _heat_color(relevance),
                        "ringColor": _ring_color(status),
                        "badge": "star" if is_strong else "",
                    },
                ),
            )
        )

    top_sponsor = sponsor_ranking[0] if sponsor_ranking else None
    edges = build_reports_to_edges(users) + build_collaboration_edges(collaborations)
    access_path = [employee_id]
    if top_sponsor:
        access_edges = build_access_path_edges(requester, users, top_sponsor)
        edges += access_edges
        access_path = [edge.source for edge in access_edges] + [access_edges[-1].target]

    return AccessGraphResponse(
        requesterEmployeeId=employee_id,
        technology=technology,
        nodes=nodes,
        edges=edges,
        sponsorRanking=sponsor_ranking,
        accessPath=access_path,
    )
