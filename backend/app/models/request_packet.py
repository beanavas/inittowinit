from typing import Literal, Optional

from pydantic import BaseModel


class AccessRequest(BaseModel):
    requestId: str
    employeeId: str
    platform: str
    status: Literal["Pending", "Approved", "Denied"]
    requestedAt: str
    businessJustification: str


class RequestPacket(BaseModel):
    platform: str
    accessCode: str
    approver: str
    requestMethod: str
    businessJustification: str
    employeeId: str
    employeeName: str
    role: str


class RequestPacketInput(BaseModel):
    employeeId: str
    platform: str
    customJustification: Optional[str] = None
