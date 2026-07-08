from typing import List, Optional

from app.models.platform import Platform, PlatformCreate, PlatformUpdate
from app.services.data_store import read_json, write_json


def get_all_platforms() -> List[Platform]:
    return [Platform(**p) for p in read_json("platforms.json")]


def get_platform(name: str) -> Optional[Platform]:
    return next(
        (p for p in get_all_platforms() if p.platform.lower() == name.lower()),
        None,
    )


def create_platform(data: PlatformCreate) -> Platform:
    raw = read_json("platforms.json")
    new_platform = data.model_dump()
    raw.append(new_platform)
    write_json("platforms.json", raw)
    return Platform(**new_platform)


def update_platform(name: str, updates: PlatformUpdate) -> Optional[Platform]:
    raw = read_json("platforms.json")
    for i, p in enumerate(raw):
        if p["platform"].lower() == name.lower():
            patch = updates.model_dump(exclude_none=True)
            raw[i].update(patch)
            write_json("platforms.json", raw)
            return Platform(**raw[i])
    return None


def delete_platform(name: str) -> bool:
    raw = read_json("platforms.json")
    filtered = [p for p in raw if p["platform"].lower() != name.lower()]
    if len(filtered) == len(raw):
        return False
    write_json("platforms.json", filtered)
    return True
