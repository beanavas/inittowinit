from typing import Dict, List

from pydantic import BaseModel


class EmployeeNode(BaseModel):
    name: str
    employeeId: str
    role: str
    access: List[str]


class OrgGraphResponse(BaseModel):
    manager: str
    managerId: str
    employees: List[EmployeeNode]
    teamAccessStats: Dict[str, float]  # platform -> adoption %


class TeamHeatmapResponse(BaseModel):
    team: str
    members: List[EmployeeNode]
    platformStats: Dict[str, float]  # platform -> adoption %
    totalMembers: int
