from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class ChatTurn(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class AssistantQueryRequest(BaseModel):
    employeeId: str
    prompt: Optional[str] = None
    action: Optional[str] = None  # one of: recommendations, access, org_graph
    history: List[ChatTurn] = []


class AssistantQueryResponse(BaseModel):
    answer: str
    data: Dict[str, Any] = {}
    focusPlatform: Optional[str] = None
    focusEmployeeId: Optional[str] = None
    source: Optional[str] = None
