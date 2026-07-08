from typing import List

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.models.access import UserAccess
from app.models.recommendation import RecommendationResponse
from app.models.request_packet import AccessRequest
from app.models.user import User
from app.services import access_service, recommendation_service, request_packet_service, user_service
from app.services.ai_service import generate_justifications

router = APIRouter()


class DashboardResponse(BaseModel):
    user: User
    access: UserAccess
    recommendations: RecommendationResponse
    pendingRequests: List[AccessRequest]


@router.get("/{employee_id}", response_model=DashboardResponse)
async def get_dashboard(employee_id: str, include_ai: bool = True):
    """
    Single endpoint that returns everything the user dashboard needs:
    profile, current access, recommendations (with AI justifications), and pending requests.
    """
    user = user_service.get_user(employee_id)
    if not user:
        raise HTTPException(status_code=404, detail=f"User '{employee_id}' not found")

    access = access_service.get_user_access(employee_id)

    try:
        recs = recommendation_service.get_recommendations(employee_id)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))

    if include_ai and recs.recommendations:
        justifications = await generate_justifications(
            role=recs.role,
            team=recs.team,
            current_access=recs.alreadyProvisioned,
            recommendations=recs.recommendations,
        )
        for rec in recs.recommendations:
            rec.justification = justifications.get(rec.platform)

    pending = [
        r for r in request_packet_service.get_requests(employee_id)
        if r.status == "Pending"
    ]

    return DashboardResponse(
        user=user,
        access=access,
        recommendations=recs,
        pendingRequests=pending,
    )
