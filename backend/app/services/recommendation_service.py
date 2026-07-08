from typing import Dict, List

from app.models.recommendation import (
    PlatformRecommendation,
    RecommendationResponse,
    RecommendationSource,
)
from app.services.access_service import get_pending_platforms, get_provisioned_platforms
from app.services.data_store import read_json, write_json
from app.services.user_service import get_user, get_users_by_team


def get_role_rules() -> Dict[str, List[str]]:
    return read_json("rules.json").get("roleRules", {})


def update_role_rules(rules: Dict[str, List[str]]) -> None:
    data = read_json("rules.json")
    data["roleRules"] = rules
    write_json("rules.json", data)


def _rule_based_platforms(role: str) -> List[str]:
    return get_role_rules().get(role, [])


def _team_pattern_adoption(team: str, role: str, employee_id: str) -> Dict[str, float]:
    """Return platform -> adoption % among same-role teammates (widens to full team if < 2 matches)."""
    all_teammates = [u for u in get_users_by_team(team) if u.employeeId != employee_id]
    role_mates = [u for u in all_teammates if u.role == role]
    group = role_mates if len(role_mates) >= 2 else all_teammates

    if not group:
        return {}

    counts: Dict[str, int] = {}
    for teammate in group:
        for platform in get_provisioned_platforms(teammate.employeeId):
            counts[platform] = counts.get(platform, 0) + 1

    total = len(group)
    return {p: (c / total) * 100 for p, c in counts.items()}


def get_recommendations(employee_id: str) -> RecommendationResponse:
    user = get_user(employee_id)
    if not user:
        raise ValueError(f"User '{employee_id}' not found")

    provisioned = get_provisioned_platforms(employee_id)
    pending = get_pending_platforms(employee_id)
    already_have = set(provisioned + pending)

    rule_platforms = set(_rule_based_platforms(user.role))
    team_adoption = _team_pattern_adoption(user.team, user.role, employee_id)

    # Candidates: rule requirements + platforms used by ≥50% of team — minus what user already has
    candidates = (
        rule_platforms | {p for p, rate in team_adoption.items() if rate >= 50}
    ) - already_have

    recommendations: List[PlatformRecommendation] = []
    for platform in candidates:
        sources: List[RecommendationSource] = []
        adoption = team_adoption.get(platform)

        if platform in rule_platforms:
            sources.append(RecommendationSource.RULE_BASED)
        if adoption is not None and adoption >= 50:
            sources.append(RecommendationSource.TEAM_PATTERN)

        # Confidence: both signals → 0.90-0.99; rule only → 0.90; team only → adoption/100
        if RecommendationSource.RULE_BASED in sources and RecommendationSource.TEAM_PATTERN in sources:
            confidence = min(0.99, 0.90 + (adoption or 0) / 1000)
        elif RecommendationSource.RULE_BASED in sources:
            confidence = 0.90
        else:
            confidence = (adoption or 0) / 100

        recommendations.append(
            PlatformRecommendation(
                platform=platform,
                confidence=round(confidence, 2),
                sources=sources,
                teamAdoptionRate=round(adoption, 1) if adoption is not None else None,
            )
        )

    recommendations.sort(key=lambda r: r.confidence, reverse=True)

    return RecommendationResponse(
        employeeId=employee_id,
        role=user.role,
        team=user.team,
        recommendations=recommendations,
        alreadyProvisioned=provisioned,
        pending=pending,
    )
