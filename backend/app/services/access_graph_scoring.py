from typing import Dict, List, Optional, Tuple

from app.models.access import AccessStatus
from app.models.access_graph import (
    ApprovalHistorySignal,
    CollaborationSignal,
    GraphAccessStatus,
    SponsorCandidate,
    SponsorScoreBreakdown,
    UsageSignal,
)
from app.models.user import User
from app.services.access_service import get_user_access
from app.services.data_store import read_json


def load_collaborations() -> List[CollaborationSignal]:
    return [CollaborationSignal(**row) for row in read_json("collaborations.json")]


def load_usage_signals() -> List[UsageSignal]:
    return [UsageSignal(**row) for row in read_json("technology_usage.json")]


def load_approval_history() -> List[ApprovalHistorySignal]:
    return [ApprovalHistorySignal(**row) for row in read_json("approval_history.json")]


def load_availability() -> Dict[str, float]:
    return read_json("availability.json")


def get_usage_signal(employee_id: str, technology: str, usage: List[UsageSignal]) -> Optional[UsageSignal]:
    return next(
        (
            item
            for item in usage
            if item.employeeId == employee_id and item.platform.lower() == technology.lower()
        ),
        None,
    )


def get_access_status(employee_id: str, technology: str, usage: List[UsageSignal]) -> Tuple[GraphAccessStatus, str, float]:
    access = get_user_access(employee_id)
    platform_access = next(
        (entry for entry in access.access if entry.platform.lower() == technology.lower()),
        None,
    )
    usage_signal = get_usage_signal(employee_id, technology, usage)

    if platform_access and platform_access.status == AccessStatus.PENDING:
        return GraphAccessStatus.PENDING, "pending", usage_signal.score if usage_signal else 0.25

    if platform_access and platform_access.status == AccessStatus.PROVISIONED:
        if usage_signal and usage_signal.intensity == "daily":
            return GraphAccessStatus.USES_DAILY, "daily", usage_signal.score
        if usage_signal and usage_signal.intensity == "weekly":
            return GraphAccessStatus.USES_WEEKLY, "weekly", usage_signal.score
        return GraphAccessStatus.HAS_ACCESS, "provisioned", usage_signal.score if usage_signal else 0.55

    return GraphAccessStatus.NO_ACCESS, "none", 0.0


def _relationship_score(
    requester_id: str,
    candidate_id: str,
    requester: User,
    candidate: User,
    collaborations: List[CollaborationSignal],
) -> float:
    if requester.manager == candidate.name or candidate.manager == requester.name:
        return 0.88
    if requester.team == candidate.team:
        return 0.72

    direct_collab = next(
        (
            c
            for c in collaborations
            if {c.sourceEmployeeId, c.targetEmployeeId} == {requester_id, candidate_id}
        ),
        None,
    )
    if direct_collab:
        return min(1.0, direct_collab.strength)

    if requester.department == candidate.department:
        return 0.42
    return 0.18


def _approval_history_score(
    requester_id: str,
    candidate_id: str,
    technology: str,
    history: List[ApprovalHistorySignal],
) -> float:
    matches = [
        h for h in history
        if h.requesterEmployeeId == requester_id and h.sponsorEmployeeId == candidate_id
    ]
    if not matches:
        return 0.0

    exact = next((h for h in matches if h.platform.lower() == technology.lower()), None)
    best = exact or min(matches, key=lambda h: h.recencyDays)
    outcome_score = 1.0 if best.outcome == "Approved" else 0.25
    recency_score = max(0.2, 1 - best.recencyDays / 180)
    return round(outcome_score * recency_score, 2)


def _candidate_reasons(
    access_status: GraphAccessStatus,
    hop_distance: int,
    breakdown: SponsorScoreBreakdown,
    candidate: User,
) -> List[str]:
    reasons = []
    if access_status in {GraphAccessStatus.USES_DAILY, GraphAccessStatus.USES_WEEKLY}:
        reasons.append(f"{access_status.value} and can explain practical setup details.")
    elif access_status == GraphAccessStatus.HAS_ACCESS:
        reasons.append("Already has access to the requested technology.")
    if hop_distance <= 1:
        reasons.append("Very close in the org or collaboration network.")
    elif hop_distance == 2:
        reasons.append("Reachable through one intermediary.")
    if breakdown.approvalHistory > 0:
        reasons.append("Has relevant approval history with this requester.")
    if breakdown.availability >= 0.75:
        reasons.append("Availability signal suggests a fast response.")
    if not reasons:
        reasons.append(f"Related through {candidate.team} or nearby work patterns.")
    return reasons


def rank_sponsors(
    requester: User,
    users: List[User],
    technology: str,
    hop_distances: Dict[str, int],
    collaborations: List[CollaborationSignal],
) -> List[SponsorCandidate]:
    usage = load_usage_signals()
    history = load_approval_history()
    availability = load_availability()

    candidates: List[SponsorCandidate] = []
    for candidate in users:
        if candidate.employeeId == requester.employeeId:
            continue

        access_status, usage_intensity, expertise = get_access_status(candidate.employeeId, technology, usage)
        hop_distance = hop_distances.get(candidate.employeeId, 4)
        proximity = max(0.0, 1 - min(hop_distance, 4) / 4)
        relationship = _relationship_score(
            requester.employeeId,
            candidate.employeeId,
            requester,
            candidate,
            collaborations,
        )
        approval_history = _approval_history_score(
            requester.employeeId,
            candidate.employeeId,
            technology,
            history,
        )
        availability_score = availability.get(candidate.employeeId, 0.5)

        breakdown = SponsorScoreBreakdown(
            orgProximity=round(proximity, 2),
            technologyExpertise=round(expertise, 2),
            relationship=round(relationship, 2),
            approvalHistory=round(approval_history, 2),
            availability=round(availability_score, 2),
        )
        score = (
            breakdown.orgProximity * 0.22
            + breakdown.technologyExpertise * 0.36
            + breakdown.relationship * 0.18
            + breakdown.approvalHistory * 0.14
            + breakdown.availability * 0.10
        )

        if access_status == GraphAccessStatus.NO_ACCESS:
            score *= 0.35
        elif access_status == GraphAccessStatus.PENDING:
            score *= 0.55

        relevance = round(score * 100, 1)
        candidates.append(
            SponsorCandidate(
                employeeId=candidate.employeeId,
                name=candidate.name,
                role=candidate.role,
                team=candidate.team,
                accessStatus=access_status,
                usageIntensity=usage_intensity,
                relevanceScore=relevance,
                scoreBreakdown=breakdown,
                reasons=_candidate_reasons(access_status, hop_distance, breakdown, candidate),
                isStrongSponsor=relevance >= 70,
            )
        )

    return sorted(candidates, key=lambda c: c.relevanceScore, reverse=True)
