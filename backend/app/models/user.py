from typing import Optional

from pydantic import BaseModel


class User(BaseModel):
    employeeId: str
    name: str
    role: str
    department: str
    manager: str
    team: str


class UserCreate(BaseModel):
    name: str
    role: str
    department: str
    manager: str
    team: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    manager: Optional[str] = None
    team: Optional[str] = None
