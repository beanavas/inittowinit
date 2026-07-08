from fastapi import APIRouter, HTTPException

from app.models.recommendation import RecommendationResponse
from app.services import recommendation_service
from app.services.ai_service import generate_justifications

router = APIRouter()


@router.get("/{employee_id}", response_model=RecommendationResponse)
async def get_recommendations(employee_id: str, include_ai: bool = True):
    """
    Returns access recommendations for an employee.

    - `include_ai=true`  — attach AI-generated justifications per platform (default)
    - `include_ai=false` — skip the AI call for faster responses
    """
    try:
        result = recommendation_service.get_recommendations(employee_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    if include_ai and result.recommendations:
        justifications = await generate_justifications(
            role=result.role,
            team=result.team,
            current_access=result.alreadyProvisioned,
            recommendations=result.recommendations,
        )
        for rec in result.recommendations:
            rec.justification = justifications.get(rec.platform)

    return result
