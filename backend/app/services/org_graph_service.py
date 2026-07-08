from typing import Dict, List, Optional

from app.models.org_graph import EmployeeNode, OrgGraphResponse, TeamHeatmapResponse
from app.services.access_service import get_provisioned_platforms
from app.services.user_service import get_all_users, get_users_by_manager, get_users_by_team


def _to_node(user) -> EmployeeNode:
    return EmployeeNode(
        name=user.name,
        employeeId=user.employeeId,
        role=user.role,
        access=get_provisioned_platforms(user.employeeId),
    )


def _access_stats(nodes: List[EmployeeNode]) -> Dict[str, float]:
    if not nodes:
        return {}
    counts: Dict[str, int] = {}
    for node in nodes:
        for platform in node.access:
            counts[platform] = counts.get(platform, 0) + 1
    total = len(nodes)
    return dict(
        sorted(
            {p: round(c / total * 100, 1) for p, c in counts.items()}.items(),
            key=lambda x: -x[1],
        )
    )


def get_org_graph(manager_name: str) -> Optional[OrgGraphResponse]:
    all_users = get_all_users()
    manager = next((u for u in all_users if u.name == manager_name), None)
    if not manager:
        return None

    reports = get_users_by_manager(manager_name)
    nodes = [_to_node(u) for u in reports]

    return OrgGraphResponse(
        manager=manager_name,
        managerId=manager.employeeId,
        employees=nodes,
        teamAccessStats=_access_stats(nodes),
    )


def get_team_heatmap(team: str) -> TeamHeatmapResponse:
    members = get_users_by_team(team)
    nodes = [_to_node(u) for u in members]

    return TeamHeatmapResponse(
        team=team,
        members=nodes,
        platformStats=_access_stats(nodes),
        totalMembers=len(nodes),
    )
