from typing import List, Optional

from pydantic import BaseModel


class PlatformAccessTier(BaseModel):
    name: str
    accessCode: str
    description: str
    approver: str


class Platform(BaseModel):
    platform: str
    accessCode: str
    approver: str
    description: str
    requestMethod: str
    category: Optional[str] = None
    prerequisites: List[str] = []
    accessTiers: List[PlatformAccessTier] = []


class PlatformCreate(BaseModel):
    platform: str
    accessCode: str
    approver: str
    description: str
    requestMethod: str
    category: Optional[str] = None
    prerequisites: List[str] = []
    accessTiers: List[PlatformAccessTier] = []


class PlatformUpdate(BaseModel):
    accessCode: Optional[str] = None
    approver: Optional[str] = None
    description: Optional[str] = None
    requestMethod: Optional[str] = None
    category: Optional[str] = None
    prerequisites: Optional[List[str]] = None
    accessTiers: Optional[List[PlatformAccessTier]] = None
