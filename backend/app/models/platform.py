from typing import List, Optional

from pydantic import BaseModel


class Platform(BaseModel):
    platform: str
    accessCode: str
    approver: str
    description: str
    requestMethod: str
    category: Optional[str] = None
    prerequisites: List[str] = []


class PlatformCreate(BaseModel):
    platform: str
    accessCode: str
    approver: str
    description: str
    requestMethod: str
    category: Optional[str] = None
    prerequisites: List[str] = []


class PlatformUpdate(BaseModel):
    accessCode: Optional[str] = None
    approver: Optional[str] = None
    description: Optional[str] = None
    requestMethod: Optional[str] = None
    category: Optional[str] = None
    prerequisites: Optional[List[str]] = None
