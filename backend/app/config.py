import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    gitlab_file_url: str = "https://gitlab.example.com/api/v4/projects/1/repository/files/data%2Fkeywords.txt/raw?ref=main"
    gitlab_token: str = ""
    gitlab_repo_url: str = "https://gitlab.example.com/barclays/gcwcs/GCWS-FS.git"
    port: int = 8000
    host: str = "0.0.0.0"

    class Config:
        env_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env")
        extra = "ignore"

settings = Settings()
