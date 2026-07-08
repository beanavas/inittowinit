import json
from typing import Any, Dict, List, Optional

import anthropic

from app.config import settings
from app.services import (
    access_service,
    catalog_service,
    org_graph_service,
    recommendation_service,
    request_packet_service,
    user_service,
)

_client: Optional[anthropic.Anthropic] = (
    anthropic.Anthropic(api_key=settings.anthropic_api_key) if settings.anthropic_api_key else None
)

MAX_TOOL_ITERATIONS = 6

SYSTEM_PROMPT = (
    "You are the assistant embedded in the Unified Access Onboarding Platform. "
    "Answer questions about an employee's platform access, recommendations, org structure, "
    "and access requests. Always call a tool to look up real data before answering — never "
    "guess or invent access status, recommendations, role rules, or org data. "
    "The platform the user is asking about right now always takes priority over anything "
    "discussed earlier in the conversation. If the current message names a different platform "
    "(even a partial name, e.g. 'Claude' for 'Claude Code') than an earlier turn, fully switch "
    "your answer to that platform via list_platforms — do not keep describing or defaulting back "
    "to a platform from earlier messages or from the employee's existing pending/provisioned "
    "access unless the current question is actually about that platform. "
    "Keep answers short and specific; reference platform names and numbers from the tool results."
)

TOOLS = [
    {
        "name": "get_user_profile",
        "description": "Look up an employee's profile: name, role, department, manager, team.",
        "input_schema": {
            "type": "object",
            "properties": {"employee_id": {"type": "string", "description": "Employee ID, e.g. E001"}},
            "required": ["employee_id"],
        },
    },
    {
        "name": "get_user_access",
        "description": "Get an employee's current platform access entries and their status (Provisioned, Pending, or Denied).",
        "input_schema": {
            "type": "object",
            "properties": {"employee_id": {"type": "string"}},
            "required": ["employee_id"],
        },
    },
    {
        "name": "get_recommendations",
        "description": (
            "Get recommended platforms for an employee to request access to, with confidence "
            "scores, team adoption rates, and justifications. Call this for 'what should I request' "
            "style questions."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"employee_id": {"type": "string"}},
            "required": ["employee_id"],
        },
    },
    {
        "name": "get_org_graph",
        "description": "Get a manager's direct reports and the team's platform adoption stats, by manager name.",
        "input_schema": {
            "type": "object",
            "properties": {"manager_name": {"type": "string", "description": "The manager's full name"}},
            "required": ["manager_name"],
        },
    },
    {
        "name": "get_team_heatmap",
        "description": "Get platform adoption stats and member access for a given team name.",
        "input_schema": {
            "type": "object",
            "properties": {"team": {"type": "string"}},
            "required": ["team"],
        },
    },
    {
        "name": "list_platforms",
        "description": "List the full platform catalog: access codes, approvers, request methods, categories.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_role_rules",
        "description": "Get the role -> required platforms mapping used by the recommendation engine.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "list_access_requests",
        "description": "List an employee's access requests and their status (Pending, Approved, Denied).",
        "input_schema": {
            "type": "object",
            "properties": {"employee_id": {"type": "string"}},
            "required": ["employee_id"],
        },
    },
]


def _execute_tool(name: str, tool_input: Dict[str, Any], default_employee_id: str) -> Any:
    employee_id = tool_input.get("employee_id") or default_employee_id

    if name == "get_user_profile":
        user = user_service.get_user(employee_id)
        if not user:
            return {"error": f"User '{employee_id}' not found"}
        return user.model_dump()

    if name == "get_user_access":
        return access_service.get_user_access(employee_id).model_dump()

    if name == "get_recommendations":
        try:
            result = recommendation_service.get_recommendations(employee_id)
        except ValueError as e:
            return {"error": str(e)}
        return result.model_dump()

    if name == "get_org_graph":
        result = org_graph_service.get_org_graph(tool_input["manager_name"])
        if not result:
            return {"error": f"Manager '{tool_input['manager_name']}' not found"}
        return result.model_dump()

    if name == "get_team_heatmap":
        return org_graph_service.get_team_heatmap(tool_input["team"]).model_dump()

    if name == "list_platforms":
        return [p.model_dump() for p in catalog_service.get_all_platforms()]

    if name == "get_role_rules":
        return recommendation_service.get_role_rules()

    if name == "list_access_requests":
        return [r.model_dump() for r in request_packet_service.get_requests(employee_id)]

    return {"error": f"Unknown tool '{name}'"}


def _detect_platform(text: str) -> Optional[str]:
    """Find which catalog platform (if any) a piece of text is about, so the frontend
    can point its graph/report at that platform without a manual picker. Matches
    partial names too (e.g. 'Claude' matches 'Claude Code'); prefers the longest,
    most specific match if several platform names appear."""
    text_lower = text.lower()
    matches = [p.platform for p in catalog_service.get_all_platforms() if p.platform.lower() in text_lower]
    return max(matches, key=len) if matches else None


def run_nl_query(
    employee_id: str, prompt: str, history: Optional[List[Dict[str, str]]] = None
) -> Dict[str, Any]:
    """Answer a free-form question by letting Claude call read-only internal tools, then
    return both a natural-language answer and the structured data gathered along the way.

    `history` is prior turns as plain {"role": "user"|"assistant", "content": str} pairs —
    it gives the model conversational memory, but each turn still gets a fresh tool-use loop."""
    if _client is None:
        return {
            "answer": "The AI assistant isn't configured yet — set ANTHROPIC_API_KEY in the backend .env.",
            "data": {},
        }

    messages: List[Dict[str, Any]] = [
        {"role": turn["role"], "content": turn["content"]} for turn in (history or [])
    ]
    messages.append({"role": "user", "content": prompt})
    collected_data: Dict[str, Any] = {}

    for _ in range(MAX_TOOL_ITERATIONS):
        response = _client.messages.create(
            model="claude-opus-4-8",
            max_tokens=1024,
            system=f"{SYSTEM_PROMPT}\n\nThe employee asking is {employee_id}.",
            tools=TOOLS,
            output_config={"effort": "low"},
            messages=messages,
        )

        if response.stop_reason != "tool_use":
            answer = "".join(block.text for block in response.content if block.type == "text")
            focus_platform = _detect_platform(prompt) or _detect_platform(answer)
            return {"answer": answer, "data": collected_data, "focusPlatform": focus_platform}

        messages.append({"role": "assistant", "content": response.content})

        tool_results = []
        for block in response.content:
            if block.type != "tool_use":
                continue
            try:
                result = _execute_tool(block.name, block.input, employee_id)
                collected_data[block.name] = result
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": json.dumps(result, default=str),
                    }
                )
            except Exception as e:  # noqa: BLE001 - surface any lookup failure back to Claude
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": str(e),
                        "is_error": True,
                    }
                )
        messages.append({"role": "user", "content": tool_results})

    return {
        "answer": "I wasn't able to finish looking that up — try a more specific question.",
        "data": collected_data,
        "focusPlatform": _detect_platform(prompt),
    }


def run_fixed_action(action: str, employee_id: str) -> Dict[str, Any]:
    """Deterministic, no-AI-call shortcuts for the platform's common actions."""
    if action == "recommendations":
        try:
            result = recommendation_service.get_recommendations(employee_id)
        except ValueError as e:
            return {"answer": str(e), "data": {}}
        data = result.model_dump()
        count = len(data["recommendations"])
        answer = (
            f"Found {count} recommended platform(s) for {data['role']} on {data['team']}."
            if count
            else "No new platform recommendations right now — you're all set."
        )
        return {"answer": answer, "data": {"get_recommendations": data}}

    if action == "access":
        data = access_service.get_user_access(employee_id).model_dump()
        provisioned = [a["platform"] for a in data["access"] if a["status"] == "Provisioned"]
        answer = (
            f"You have access to: {', '.join(provisioned)}." if provisioned else "You have no provisioned access yet."
        )
        return {"answer": answer, "data": {"get_user_access": data}}

    if action == "org_graph":
        user = user_service.get_user(employee_id)
        if not user:
            return {"answer": f"User '{employee_id}' not found", "data": {}}
        result = org_graph_service.get_org_graph(user.manager)
        if not result:
            return {"answer": f"Manager '{user.manager}' not found", "data": {}}
        data = result.model_dump()
        answer = f"{data['manager']} has {len(data['employees'])} direct report(s)."
        return {"answer": answer, "data": {"get_org_graph": data}}

    return {"answer": f"Unknown action '{action}'", "data": {}}
