from dataclasses import dataclass
import os
from dotenv import load_dotenv

load_dotenv()
@dataclass(frozen=True)
class Settings:
    app_name: str = "NewsMind AI Service"
    environment: str = os.getenv("NODE_ENV", os.getenv("ENVIRONMENT", "development"))
    router_encoder: str = os.getenv("ROUTER_ENCODER", "fastembed")
    fastembed_model: str = os.getenv(
        "FASTEMBED_MODEL",
        "BAAI/bge-small-en-v1.5",
    )
    gemini_api_key: str = os.getenv("GEMINI_API_KEY", "")
    nvidia_api_key: str = os.getenv("NVIDIA_API_KEY", "")
    openrouter_api_key: str = os.getenv("OPENROUTER_API_KEY", "")
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379")


settings = Settings()
