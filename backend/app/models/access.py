from enum import Enum
from typing import List

from pydantic import BaseModel


class AccessStatus(str, Enum):
    PROVISIONED = "Provisioned"
    PENDING = "Pending"
    DENIED = "Denied"


class AccessEntry(BaseModel):
    platform: str
    status: AccessStatus


class UserAccess(BaseModel):
    employeeId: str
    access: List[AccessEntry]


class AccessUpdateRequest(BaseModel):
    platform: str
    status: AccessStatus
