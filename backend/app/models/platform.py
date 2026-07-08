from typing import Optional

from pydantic import BaseModel


class Platform(BaseModel):
    platform: str
    accessCode: str
    approver: str
    description: str
    requestMethod: str
    category: Optional[str] = None


class PlatformCreate(BaseModel):
    platform: str
    accessCode: str
    approver: str
    description: str
    requestMethod: str
    category: Optional[str] = None


class PlatformUpdate(BaseModel):
    accessCode: Optional[str] = None
    approver: Optional[str] = None
    description: Optional[str] = None
    requestMethod: Optional[str] = None
    category: Optional[str] = None
