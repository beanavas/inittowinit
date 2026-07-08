import uuid
from datetime import datetime, timezone
from typing import List, Optional

from app.models.access import AccessStatus
from app.models.recommendation import PlatformRecommendation, RecommendationSource
from app.models.request_packet import AccessRequest, RequestPacket, RequestPacketInput
from app.services.access_service import update_access_status
from app.services.ai_service import get_template_justifications
from app.services.catalog_service import get_platform
from app.services.data_store import read_json, write_json
from app.services.user_service import get_user


def get_requests(employee_id: Optional[str] = None) -> List[AccessRequest]:
    raw = read_json("requests.json")
    requests = [AccessRequest(**r) for r in raw]
    if employee_id:
        requests = [r for r in requests if r.employeeId == employee_id]
    return requests


def generate_request_packet(data: RequestPacketInput) -> RequestPacket:
    user = get_user(data.employeeId)
    if not user:
        raise ValueError(f"User '{data.employeeId}' not found")

    platform = get_platform(data.platform)
    if not platform:
        raise ValueError(f"Platform '{data.platform}' not found in catalog")

    if data.customJustification:
        justification = data.customJustification
    else:
        dummy = PlatformRecommendation(
            platform=data.platform,
            confidence=1.0,
            sources=[RecommendationSource.RULE_BASED],
        )
        justification = get_template_justifications([dummy], user.role)[data.platform]

    return RequestPacket(
        platform=platform.platform,
        accessCode=platform.accessCode,
        approver=platform.approver,
        requestMethod=platform.requestMethod,
        businessJustification=justification,
        employeeId=user.employeeId,
        employeeName=user.name,
        role=user.role,
    )


def submit_request(employee_id: str, platform: str, justification: str) -> AccessRequest:
    """Persist a new request record and mark the platform as Pending in access.json."""
    raw = read_json("requests.json")

    new_request = {
        "requestId": f"REQ{uuid.uuid4().hex[:8].upper()}",
        "employeeId": employee_id,
        "platform": platform,
        "status": "Pending",
        "requestedAt": datetime.now(timezone.utc).isoformat(),
        "businessJustification": justification,
    }
    raw.append(new_request)
    write_json("requests.json", raw)

    update_access_status(employee_id, platform, AccessStatus.PENDING)

    return AccessRequest(**new_request)


def decide_request(request_id: str, decision: str) -> AccessRequest:
    """Approve or deny a pending request, updating both requests.json and access.json."""
    if decision not in ("Approved", "Denied"):
        raise ValueError("decision must be 'Approved' or 'Denied'")

    raw = read_json("requests.json")
    entry = next((r for r in raw if r["requestId"] == request_id), None)
    if not entry:
        raise ValueError(f"Request '{request_id}' not found")

    entry["status"] = decision
    write_json("requests.json", raw)

    update_access_status(
        entry["employeeId"],
        entry["platform"],
        AccessStatus.PROVISIONED if decision == "Approved" else AccessStatus.DENIED,
    )

    return AccessRequest(**entry)
