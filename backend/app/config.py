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
    allowed_origins: List[str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
    ]

    model_config = {"env_file": ".env"}


settings = Settings()
