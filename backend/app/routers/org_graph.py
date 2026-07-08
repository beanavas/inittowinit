from fastapi import APIRouter, HTTPException

from app.models.org_graph import OrgGraphResponse, TeamHeatmapResponse
from app.services import org_graph_service

router = APIRouter()


@router.get("/manager/{manager_name}", response_model=OrgGraphResponse)
def get_org_graph(manager_name: str):
    """Returns the org tree for a manager with per-platform team adoption stats."""
    result = org_graph_service.get_org_graph(manager_name)
    if not result:
        raise HTTPException(status_code=404, detail=f"Manager '{manager_name}' not found")
    return result


@router.get("/team/{team}", response_model=TeamHeatmapResponse)
def get_team_heatmap(team: str):
    """Returns all team members with their access and platform adoption percentages."""
    return org_graph_service.get_team_heatmap(team)
