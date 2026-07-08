from fastapi import APIRouter, HTTPException

from app.models.assistant import AssistantQueryRequest, AssistantQueryResponse
from app.services import assistant_service

router = APIRouter()


@router.post("/query", response_model=AssistantQueryResponse)
def query_assistant(data: AssistantQueryRequest):
    """
    Single entry point for the frontend's assistant box.

    - Pass `action` (e.g. "recommendations", "access", "org_graph") for an instant,
      deterministic answer to one of the platform's built-in commands.
    - Pass `prompt` for a free-form question — Claude looks up the relevant internal
      data via tool calls and answers from it.
    """
    if data.action:
        result = assistant_service.run_fixed_action(data.action, data.employeeId)
    elif data.prompt:
        history = [turn.model_dump() for turn in data.history]
        result = assistant_service.run_nl_query(data.employeeId, data.prompt, history)
    else:
        raise HTTPException(status_code=400, detail="Provide either 'action' or 'prompt'")

    return AssistantQueryResponse(**result)
