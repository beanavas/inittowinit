from typing import Dict, List

from app.models.access_graph import (
    AccessGraphNode,
    AccessGraphNodeData,
    AccessGraphResponse,
    GraphAccessStatus,
)
from app.services import user_service
from app.services.access_graph_edges import (
    build_relationship_edges,
    build_relationship_graph,
    calculate_hop_distances,
)
from app.services.access_graph_layout import calculate_hop_ring_layout
from app.services.access_graph_scoring import (
    get_access_status,
    load_collaborations,
    load_usage_signals,
    rank_sponsors,
)

# Only show people reachable within this many hops via team/tool/collaboration —
# "aggregate the closest connections" rather than the whole company.
NODE_HOP_LIMIT = 5
ORG_CHART_MANAGER_HOP_LIMIT = 2


def _heat_color(score: float) -> str:
    if score >= 80:
        return "#001f45"
    if score >= 65:
        return "#007bc3"
    if score >= 45:
        return "#4d9fd1"
    if score >= 20:
        return "#94a3b3"
    return "#d9e2ea"


def _ring_color(status: GraphAccessStatus) -> str:
    return {
        GraphAccessStatus.USES_DAILY: "#1e7b45",
        GraphAccessStatus.USES_WEEKLY: "#4a9d6c",
        GraphAccessStatus.HAS_ACCESS: "#007bc3",
        GraphAccessStatus.PENDING: "#a15c00",
        GraphAccessStatus.NO_ACCESS: "#94a3b3",
    }[status]


def _requester_org_pairs(employee_id: str, users: List[object]) -> set[frozenset[str]]:
    by_id = {user.employeeId: user for user in users}
    by_name = {user.name: user for user in users}
    pairs: set[frozenset[str]] = set()
    current = by_id.get(employee_id)

    for _ in range(ORG_CHART_MANAGER_HOP_LIMIT):
        if not current:
            break
        manager = by_name.get(current.manager)
        if not manager:
            break
        pairs.add(frozenset({current.employeeId, manager.employeeId}))
        current = manager

    return pairs


def build_access_graph(employee_id: str, technology: str) -> AccessGraphResponse:
    requester = user_service.get_user(employee_id)
    if not requester:
        raise ValueError(f"User '{employee_id}' not found")

    all_users = user_service.get_all_users()
    collaborations = load_collaborations()
    usage = load_usage_signals()

    allowed_report_pairs = _requester_org_pairs(employee_id, all_users)
    relationship_graph = build_relationship_graph(
        all_users, technology, usage, collaborations, allowed_report_pairs
    )
    hop_distances = calculate_hop_distances(employee_id, relationship_graph)
    max_hop = max(hop_distances.values(), default=0)
    hidden_node_count_by_hop: Dict[int, int] = {}
    for user in all_users:
        hop = hop_distances.get(user.employeeId, 99)
        if hop > NODE_HOP_LIMIT:
            hidden_node_count_by_hop[hop] = hidden_node_count_by_hop.get(hop, 0) + 1

    users = [u for u in all_users if hop_distances.get(u.employeeId, 99) <= NODE_HOP_LIMIT]

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
                    manager=user.manager,
                    mail=user.mail,
                    title=user.title,
                    directoryUser=user.user,
                    memberships=user.memberships,
                    accessStatus=status,
                    usageIntensity=intensity,
                    relevanceScore=round(relevance, 1),
                    scoreBreakdown=sponsor.scoreBreakdown if sponsor else None,
                    isCurrentUser=user.employeeId == employee_id,
                    isStrongSponsor=is_strong,
                    hopDistance=hop_distances[user.employeeId],
                    visual={
                        "heatColor": "#001f45" if user.employeeId == employee_id else _heat_color(relevance),
                        "ringColor": _ring_color(status),
                        "badge": "strong" if is_strong else "",
                    },
                ),
            )
        )

    edges = build_relationship_edges(
        users,
        technology,
        usage,
        collaborations,
        employee_id,
        hop_distances,
        relationship_graph,
        allowed_report_pairs,
    )
    top_sponsor = sponsor_ranking[0] if sponsor_ranking else None
    access_path = [employee_id, top_sponsor.employeeId] if top_sponsor else [employee_id]

    return AccessGraphResponse(
        requesterEmployeeId=employee_id,
        technology=technology,
        nodes=nodes,
        edges=edges,
        sponsorRanking=sponsor_ranking,
        accessPath=access_path,
        maxHop=max_hop,
        visibleHopLimit=NODE_HOP_LIMIT,
        hiddenNodeCountByHop=hidden_node_count_by_hop,
    )
