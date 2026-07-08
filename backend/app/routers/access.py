from typing import List

from fastapi import APIRouter

from app.models.access import AccessUpdateRequest, UserAccess
from app.services import access_service

router = APIRouter()


@router.get("", response_model=List[UserAccess])
def list_all_access():
    return access_service.get_all_access()


@router.get("/{employee_id}", response_model=UserAccess)
def get_user_access(employee_id: str):
    return access_service.get_user_access(employee_id)


@router.patch("/{employee_id}", response_model=UserAccess)
def update_access(employee_id: str, update: AccessUpdateRequest):
    return access_service.update_access_status(
        employee_id, update.platform, update.status
    )
