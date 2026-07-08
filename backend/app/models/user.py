from typing import Optional

from pydantic import BaseModel, StringConstraints
from typing_extensions import Annotated

NonEmptyStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class User(BaseModel):
    employeeId: NonEmptyStr
    name: NonEmptyStr
    role: NonEmptyStr
    department: NonEmptyStr
    manager: NonEmptyStr
    team: NonEmptyStr


class UserCreate(BaseModel):
    employeeId: NonEmptyStr
    name: NonEmptyStr
    role: NonEmptyStr
    department: NonEmptyStr
    manager: NonEmptyStr
    team: NonEmptyStr


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    manager: Optional[str] = None
    team: Optional[str] = None
