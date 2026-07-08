import math
from collections import defaultdict
from typing import Dict, List

from app.models.access_graph import AccessGraphPosition
from app.models.user import User


def calculate_hop_ring_layout(
    users: List[User],
    hop_distances: Dict[str, int],
    requester_id: str,
) -> Dict[str, AccessGraphPosition]:
    rings = defaultdict(list)
    for user in users:
        rings[hop_distances.get(user.employeeId, 4)].append(user)

    positions: Dict[str, AccessGraphPosition] = {
        requester_id: AccessGraphPosition(x=0, y=0)
    }

    for hop, ring_users in sorted(rings.items()):
        if hop == 0:
            continue

        radius = 220 * hop
        count = len(ring_users)
        offset = -math.pi / 2
        for index, user in enumerate(sorted(ring_users, key=lambda u: (u.team, u.name))):
            angle = offset + (2 * math.pi * index / max(count, 1))
            positions[user.employeeId] = AccessGraphPosition(
                x=round(math.cos(angle) * radius, 2),
                y=round(math.sin(angle) * radius, 2),
            )

    return positions
