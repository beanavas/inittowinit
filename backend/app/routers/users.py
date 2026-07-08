from typing import List

from fastapi import APIRouter, HTTPException

from app.models.user import User, UserCreate, UserUpdate
from app.services import user_service

router = APIRouter()


@router.get("", response_model=List[User])
def list_users():
    return user_service.get_all_users()


@router.post("", response_model=User, status_code=201)
def create_user(data: UserCreate):
    try:
        return user_service.create_user(data)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.get("/team/{team}", response_model=List[User])
def get_users_by_team(team: str):
    return user_service.get_users_by_team(team)


@router.get("/manager/{manager_name}", response_model=List[User])
def get_users_by_manager(manager_name: str):
    return user_service.get_users_by_manager(manager_name)


@router.get("/{employee_id}", response_model=User)
def get_user(employee_id: str):
    user = user_service.get_user(employee_id)
    if not user:
        raise HTTPException(status_code=404, detail=f"User '{employee_id}' not found")
    return user


@router.patch("/{employee_id}", response_model=User)
def update_user(employee_id: str, updates: UserUpdate):
    user = user_service.update_user(employee_id, updates)
    if not user:
        raise HTTPException(status_code=404, detail=f"User '{employee_id}' not found")
    return user
