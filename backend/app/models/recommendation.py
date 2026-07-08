from enum import Enum
from typing import List, Optional

from pydantic import BaseModel


class RecommendationSource(str, Enum):
    RULE_BASED = "rule_based"
    TEAM_PATTERN = "team_pattern"


class PlatformRecommendation(BaseModel):
    platform: str
    confidence: float  # 0.0 – 1.0
    sources: List[RecommendationSource]
    teamAdoptionRate: Optional[float] = None  # percentage 0–100
    justification: Optional[str] = None  # AI-generated explanation


class RecommendationResponse(BaseModel):
    employeeId: str
    role: str
    team: str
    recommendations: List[PlatformRecommendation]
    alreadyProvisioned: List[str]
    pending: List[str]
