from typing import List

from app.models.access import AccessEntry, AccessStatus, UserAccess
from app.services.data_store import read_json, write_json


def get_user_access(employee_id: str) -> UserAccess:
    data = read_json("access.json")
    entry = next((a for a in data if a["employeeId"] == employee_id), None)
    if entry is None:
        return UserAccess(employeeId=employee_id, access=[])
    return UserAccess(**entry)


def get_all_access() -> List[UserAccess]:
    return [UserAccess(**a) for a in read_json("access.json")]


def update_access_status(employee_id: str, platform: str, status: AccessStatus) -> UserAccess:
    data = read_json("access.json")
    entry = next((a for a in data if a["employeeId"] == employee_id), None)

    if entry is None:
        data.append({
            "employeeId": employee_id,
            "access": [{"platform": platform, "status": status.value}],
        })
    else:
        platform_entry = next((a for a in entry["access"] if a["platform"] == platform), None)
        if platform_entry:
            platform_entry["status"] = status.value
        else:
            entry["access"].append({"platform": platform, "status": status.value})

    write_json("access.json", data)
    return get_user_access(employee_id)


def get_provisioned_platforms(employee_id: str) -> List[str]:
    ua = get_user_access(employee_id)
    return [a.platform for a in ua.access if a.status == AccessStatus.PROVISIONED]


def get_pending_platforms(employee_id: str) -> List[str]:
    ua = get_user_access(employee_id)
    return [a.platform for a in ua.access if a.status == AccessStatus.PENDING]
