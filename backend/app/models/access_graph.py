from enum import Enum
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class GraphEdgeType(str, Enum):
    REPORTS_TO = "reports_to"
    TEAM = "team"
    TOOL = "tool"
    WORKS_WITH = "works_with"


class GraphAccessStatus(str, Enum):
    USES_DAILY = "Uses daily"
    USES_WEEKLY = "Uses weekly"
    HAS_ACCESS = "Has access"
    PENDING = "Pending"
    NO_ACCESS = "No access"


class UsageSignal(BaseModel):
    employeeId: str
    platform: str
    intensity: str
    score: float


class CollaborationSignal(BaseModel):
    sourceEmployeeId: str
    targetEmployeeId: str
    strength: float
    reason: str


class ApprovalHistorySignal(BaseModel):
    requesterEmployeeId: str
    sponsorEmployeeId: str
    platform: str
    outcome: str
    recencyDays: int


class SponsorScoreBreakdown(BaseModel):
    orgProximity: float
    technologyExpertise: float
    relationship: float
    approvalHistory: float
    availability: float


class SponsorCandidate(BaseModel):
    employeeId: str
    name: str
    role: str
    team: str
    accessStatus: GraphAccessStatus
    usageIntensity: str
    relevanceScore: float
    scoreBreakdown: SponsorScoreBreakdown
    reasons: List[str]
    isStrongSponsor: bool
    hopDistance: int


class AccessGraphNodeData(BaseModel):
    employeeId: str
    name: str
    role: str
    team: str
    department: str
    mail: Optional[str] = None
    title: Optional[str] = None
    directoryUser: Optional[str] = None
    memberships: List[str] = Field(default_factory=list)
    accessStatus: GraphAccessStatus
    usageIntensity: str
    relevanceScore: float
    scoreBreakdown: Optional[SponsorScoreBreakdown] = None
    isCurrentUser: bool = False
    isStrongSponsor: bool = False
    hopDistance: int
    visual: Dict[str, str]


class AccessGraphPosition(BaseModel):
    x: float
    y: float


class AccessGraphNode(BaseModel):
    id: str
    type: str = "employee"
    position: AccessGraphPosition
    data: AccessGraphNodeData


class AccessGraphEdgeData(BaseModel):
    edgeType: GraphEdgeType
    label: str
    reason: Optional[str] = None
    visual: Dict[str, str]


class AccessGraphEdge(BaseModel):
    id: str
    source: str
    target: str
    type: str = "smoothstep"
    animated: bool = False
    data: AccessGraphEdgeData


class AccessGraphResponse(BaseModel):
    requesterEmployeeId: str
    technology: str
    nodes: List[AccessGraphNode]
    edges: List[AccessGraphEdge]
    sponsorRanking: List[SponsorCandidate]
    accessPath: List[str]
    maxHop: int
    visibleHopLimit: int
    hiddenNodeCountByHop: Dict[int, int]
