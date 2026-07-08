from typing import Any, Dict, Optional

from pydantic import BaseModel


class AssistantQueryRequest(BaseModel):
    employeeId: str
    prompt: Optional[str] = None
    action: Optional[str] = None  # one of: recommendations, access, org_graph


class AssistantQueryResponse(BaseModel):
    answer: str
    data: Dict[str, Any] = {}
