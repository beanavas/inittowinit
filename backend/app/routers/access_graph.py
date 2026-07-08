from fastapi import APIRouter, HTTPException, Query

from app.models.access_graph import AccessGraphResponse
from app.services import access_graph_service

router = APIRouter()


@router.get("/{employee_id}", response_model=AccessGraphResponse)
def get_access_graph(
    employee_id: str,
    technology: str = Query(..., min_length=1),
):
    """
    Return a React Flow-ready employee access graph centered on the requester.

    The response includes prepared nodes, typed org/collaboration/access-path edges,
    and the ranked sponsor list that explains the highlighted access path.
    """
    try:
        return access_graph_service.build_access_graph(employee_id, technology)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
