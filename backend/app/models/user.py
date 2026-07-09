from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from typing_extensions import Annotated

NonEmptyStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class User(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    employeeId: NonEmptyStr
    name: NonEmptyStr
    role: NonEmptyStr
    department: NonEmptyStr
    manager: NonEmptyStr
    team: NonEmptyStr
    additionalTeams: List[str] = Field(default_factory=list)
    description: Optional[str] = Field(default=None, alias="Description")
    fullName: Optional[str] = Field(default=None, alias="Full Name")
    homeDrive: Optional[str] = Field(default=None, alias="Home Drive")
    lockedOut: Optional[bool] = Field(default=None, alias="LockedOut")
    loginScriptPath: Optional[str] = Field(default=None, alias="Login Script Path")
    mail: Optional[str] = Field(default=None, alias="Mail")
    memberships: List[str] = Field(default_factory=list, alias="Memberships")
    title: Optional[str] = Field(default=None, alias="Title")
    user: Optional[str] = Field(default=None, alias="User")

    def teams(self) -> set:
        return {self.team, *self.additionalTeams}


class UserCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    employeeId: NonEmptyStr
    name: NonEmptyStr
    role: NonEmptyStr
    department: NonEmptyStr
    manager: NonEmptyStr
    team: NonEmptyStr
    additionalTeams: List[str] = Field(default_factory=list)
    description: Optional[str] = Field(default=None, alias="Description")
    fullName: Optional[str] = Field(default=None, alias="Full Name")
    homeDrive: Optional[str] = Field(default=None, alias="Home Drive")
    lockedOut: Optional[bool] = Field(default=None, alias="LockedOut")
    loginScriptPath: Optional[str] = Field(default=None, alias="Login Script Path")
    mail: Optional[str] = Field(default=None, alias="Mail")
    memberships: List[str] = Field(default_factory=list, alias="Memberships")
    title: Optional[str] = Field(default=None, alias="Title")
    user: Optional[str] = Field(default=None, alias="User")


class UserUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    name: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    manager: Optional[str] = None
    team: Optional[str] = None
    additionalTeams: Optional[List[str]] = None
    description: Optional[str] = Field(default=None, alias="Description")
    fullName: Optional[str] = Field(default=None, alias="Full Name")
    homeDrive: Optional[str] = Field(default=None, alias="Home Drive")
    lockedOut: Optional[bool] = Field(default=None, alias="LockedOut")
    loginScriptPath: Optional[str] = Field(default=None, alias="Login Script Path")
    mail: Optional[str] = Field(default=None, alias="Mail")
    memberships: Optional[List[str]] = Field(default=None, alias="Memberships")
    title: Optional[str] = Field(default=None, alias="Title")
    user: Optional[str] = Field(default=None, alias="User")
