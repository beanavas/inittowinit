from typing import List, Optional

from fastapi import APIRouter, HTTPException

from app.models.request_packet import AccessRequest, RequestDecision, RequestPacket, RequestPacketInput
from app.services import request_packet_service

router = APIRouter()


@router.get("", response_model=List[AccessRequest])
def list_requests(employee_id: Optional[str] = None):
    """List all requests, optionally filtered by employee."""
    return request_packet_service.get_requests(employee_id)


@router.post("/generate", response_model=RequestPacket)
def generate_packet(data: RequestPacketInput):
    """
    Generate a ready-to-submit request packet for a platform.
    Does NOT persist anything — call /submit to record the request.
    """
    try:
        return request_packet_service.generate_request_packet(data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/submit", response_model=AccessRequest, status_code=201)
def submit_request(data: RequestPacketInput):
    """
    Generate a packet and persist it to requests.json.
    Also marks the platform as Pending in the user's access record.
    """
    try:
        packet = request_packet_service.generate_request_packet(data)
        return request_packet_service.submit_request(
            data.employeeId,
            data.platform,
            data.customJustification or packet.businessJustification,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{request_id}/decision", response_model=AccessRequest)
def decide_request(request_id: str, data: RequestDecision):
    """Approve or deny a pending request. Updates the requester's access status accordingly."""
    try:
        return request_packet_service.decide_request(request_id, data.decision)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
