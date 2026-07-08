from typing import Dict, List

from fastapi import APIRouter, HTTPException

from app.models.platform import Platform, PlatformCreate, PlatformUpdate
from app.services import catalog_service, recommendation_service

router = APIRouter()


# ── Platform catalog ───────────────────────────────────────────────────────────

@router.get("/platforms", response_model=List[Platform])
def list_platforms():
    return catalog_service.get_all_platforms()


@router.post("/platforms", response_model=Platform, status_code=201)
def create_platform(data: PlatformCreate):
    if catalog_service.get_platform(data.platform):
        raise HTTPException(status_code=409, detail=f"Platform '{data.platform}' already exists")
    return catalog_service.create_platform(data)


@router.patch("/platforms/{platform_name}", response_model=Platform)
def update_platform(platform_name: str, updates: PlatformUpdate):
    result = catalog_service.update_platform(platform_name, updates)
    if not result:
        raise HTTPException(status_code=404, detail=f"Platform '{platform_name}' not found")
    return result


@router.delete("/platforms/{platform_name}", status_code=204)
def delete_platform(platform_name: str):
    if not catalog_service.delete_platform(platform_name):
        raise HTTPException(status_code=404, detail=f"Platform '{platform_name}' not found")


# ── Recommendation rules ───────────────────────────────────────────────────────

@router.get("/rules", response_model=Dict[str, List[str]])
def get_rules():
    """Return the role → required platforms mapping used by the recommendation engine."""
    return recommendation_service.get_role_rules()


@router.put("/rules", response_model=Dict[str, List[str]])
def update_rules(rules: Dict[str, List[str]]):
    """Replace the entire role rules map. Triggers no access changes — updates recommendations only."""
    recommendation_service.update_role_rules(rules)
    return recommendation_service.get_role_rules()
