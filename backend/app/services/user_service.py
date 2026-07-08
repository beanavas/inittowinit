from typing import List, Optional

from app.models.user import User, UserCreate, UserUpdate
from app.services.data_store import read_json, write_json


def get_all_users() -> List[User]:
    return [User(**u) for u in read_json("users.json")]


def get_user(employee_id: str) -> Optional[User]:
    return next((u for u in get_all_users() if u.employeeId == employee_id), None)


def get_users_by_team(team: str) -> List[User]:
    return [u for u in get_all_users() if u.team == team]


def get_users_by_manager(manager: str) -> List[User]:
    return [u for u in get_all_users() if u.manager == manager]


def get_users_by_role(role: str) -> List[User]:
    return [u for u in get_all_users() if u.role == role]


def create_user(data: UserCreate) -> User:
    raw = read_json("users.json")
    existing_ids = {u["employeeId"] for u in raw}
    if data.employeeId in existing_ids:
        raise ValueError(f"User '{data.employeeId}' already exists")
    new_user = data.model_dump()
    raw.append(new_user)
    write_json("users.json", raw)
    return User(**new_user)


def update_user(employee_id: str, updates: UserUpdate) -> Optional[User]:
    raw = read_json("users.json")
    for i, u in enumerate(raw):
        if u["employeeId"] == employee_id:
            patch = {k: v for k, v in updates.model_dump().items() if v is not None}
            raw[i].update(patch)
            write_json("users.json", raw)
            return User(**raw[i])
    return None
