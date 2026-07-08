import json
from typing import Dict, List, Optional

import httpx

from app.config import settings
from app.models.recommendation import PlatformRecommendation


# ── Prompt builder ─────────────────────────────────────────────────────────────

def _build_prompt(
    role: str,
    team: str,
    current_access: List[str],
    recommendations: List[PlatformRecommendation],
) -> str:
    lines = []
    for r in recommendations:
        parts = [f"- {r.platform}"]
        if r.teamAdoptionRate is not None:
            parts.append(f"(team adoption: {r.teamAdoptionRate:.0f}%)")
        if "rule_based" in [s.value for s in r.sources]:
            parts.append("[role requirement]")
        lines.append(" ".join(parts))

    return (
        "You are an enterprise access management assistant. "
        "Write a brief, professional one-sentence justification (max 25 words) "
        "for each recommended platform below.\n\n"
        f"Employee role: {role}\nTeam: {team}\n"
        f"Current access: {', '.join(current_access) or 'none'}\n\n"
        "Recommended platforms:\n" + "\n".join(lines) + "\n\n"
        "Return ONLY a JSON object — platform names as keys, justification strings as values. "
        "No markdown, no extra text."
    )


# ── Provider calls ─────────────────────────────────────────────────────────────

async def _call_anthropic(prompt: str) -> str:
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": settings.anthropic_api_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-haiku-4-5",
                "max_tokens": 1024,
                "messages": [{"role": "user", "content": prompt}],
            },
        )
        resp.raise_for_status()
        return resp.json()["content"][0]["text"]


async def _call_openai(prompt: str) -> str:
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.openai_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "gpt-4o-mini",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 1024,
            },
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


# ── Fallback templates ─────────────────────────────────────────────────────────

_TEMPLATE_JUSTIFICATIONS: Dict[str, str] = {
    "GitHub": "Required for source control, code review, and collaboration on team repositories.",
    "Jira": "Used for project and issue tracking across engineering and product workflows.",
    "Confluence": "Primary documentation and knowledge-sharing platform for the team.",
    "AWS": "Required for deploying and managing cloud-hosted applications and services.",
    "Azure": "Provides cloud infrastructure and data services for development and analytics.",
    "Databricks": "Unified analytics platform for data engineering, ML, and pipeline orchestration.",
    "Tableau": "Business intelligence tool for building and consuming data dashboards.",
    "Terraform": "Infrastructure-as-code tool for provisioning cloud resources consistently.",
    "Miro": "Collaborative whiteboard used for planning, architecture design, and workshops.",
}


def get_template_justifications(
    recommendations: List[PlatformRecommendation], role: str
) -> Dict[str, str]:
    return {
        r.platform: _TEMPLATE_JUSTIFICATIONS.get(
            r.platform,
            f"Access to {r.platform} is required for {role} day-to-day responsibilities.",
        )
        for r in recommendations
    }


# ── Public interface ───────────────────────────────────────────────────────────

async def generate_justifications(
    role: str,
    team: str,
    current_access: List[str],
    recommendations: List[PlatformRecommendation],
) -> Dict[str, str]:
    """
    Returns platform → justification string.
    Calls the configured AI provider; falls back to static templates if unavailable.

    NOTE: The AI only explains decisions already made by the rule/pattern engine —
    it never decides which access to grant.
    """
    if not recommendations:
        return {}

    raw_text: Optional[str] = None
    try:
        prompt = _build_prompt(role, team, current_access, recommendations)
        if settings.ai_provider == "anthropic" and settings.anthropic_api_key:
            raw_text = await _call_anthropic(prompt)
        elif settings.openai_api_key:
            raw_text = await _call_openai(prompt)
    except Exception:
        pass  # Degrade gracefully to template justifications

    if raw_text:
        try:
            text = raw_text.strip()
            # Strip markdown code fences if present
            if text.startswith("```"):
                text = text.split("```")[1].lstrip("json").strip()
            return json.loads(text)
        except (json.JSONDecodeError, IndexError, ValueError):
            pass

    return get_template_justifications(recommendations, role)
