import os
from pydantic import BaseModel


class Settings(BaseModel):
    openai_api_key: str = os.getenv("OPENAI_API_KEY", "")


settings = Settings()
