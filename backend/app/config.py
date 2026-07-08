from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Unified Access Onboarding Platform"
    debug: bool = False
    data_dir: Path = Path(__file__).parent / "data"

    # AI provider
    ai_provider: str = "anthropic"  # "anthropic" or "openai"
    anthropic_api_key: str = ""
    openai_api_key: str = ""

    # CORS
    allowed_origins: List[str] = ["http://localhost:3000", "http://localhost:5173"]

    model_config = {"env_file": ".env"}


settings = Settings()
