from pydantic import BaseModel, Field, field_validator
from typing import List, Optional

class FeedSchema(BaseModel):
    id: str = Field(..., description="The feed or special list name")
    keywords: List[str] = Field(default_factory=list, description="List of keywords")
    bu: str = Field("", description="Business Unit")
    public: str = Field("", description="Public indicator/value")
    private: str = Field("", description="Private indicator/value")

class FeedKeywordsResponse(BaseModel):
    feed_name: str
    keywords: List[str]

class KeywordAddRequest(BaseModel):
    keyword: str
    feed_name: str
    add_to_clp: bool = False
    add_to_core: bool = False

    @field_validator("keyword")
    def validate_keyword(cls, v):
        val = v.strip()
        if not val:
            raise ValueError("Keyword must not be empty")
        return val

    @field_validator("feed_name")
    def validate_feed(cls, v):
        val = v.strip()
        if not val:
            raise ValueError("Feed name must be selected")
        return val

class KeywordAddMultipleRequest(BaseModel):
    keyword: str
    feed_names: List[str]
    add_to_clp: bool = False
    add_to_core: bool = False

    @field_validator("keyword")
    def validate_keyword(cls, v):
        val = v.strip()
        if not val:
            raise ValueError("Keyword must not be empty")
        return val

    @field_validator("feed_names")
    def validate_feeds(cls, v):
        if not v or not [name.strip() for name in v if name.strip()]:
            raise ValueError("At least one feed name must be selected")
        return [name.strip() for name in v if name.strip()]

class KeywordRemoveFeedRequest(BaseModel):
    keyword: str
    feed_name: str

    @field_validator("keyword", "feed_name")
    def validate_non_empty(cls, v):
        val = v.strip()
        if not val:
            raise ValueError("Values must not be empty")
        return val

class KeywordRemoveMultipleRequest(BaseModel):
    keyword: str
    feed_names: List[str]

    @field_validator("keyword")
    def validate_keyword(cls, v):
        val = v.strip()
        if not val:
            raise ValueError("Keyword must not be empty")
        return val

    @field_validator("feed_names")
    def validate_feeds(cls, v):
        if not v or not [name.strip() for name in v if name.strip()]:
            raise ValueError("At least one feed name must be selected")
        return [name.strip() for name in v if name.strip()]

class KeywordRemoveCompleteRequest(BaseModel):
    keyword: str

    @field_validator("keyword")
    def validate_non_empty(cls, v):
        val = v.strip()
        if not val:
            raise ValueError("Keyword must not be empty")
        return val

class FeedDiff(BaseModel):
    feed_name: str
    status: str  # "added" (only local), "removed" (only gitlab), "modified", "unchanged"
    local_keywords: List[str] = []
    gitlab_keywords: List[str] = []
    added_keywords: List[str] = []   # present in local but not gitlab
    removed_keywords: List[str] = [] # present in gitlab but not local

class CompareSummary(BaseModel):
    total_feeds_compared: int
    feeds_added: int
    feeds_removed: int
    feeds_modified: int
    feeds_unchanged: int

class CompareResponse(BaseModel):
    summary: CompareSummary
    details: List[FeedDiff]
    special_lists: List[FeedDiff]

class DeployRequest(BaseModel):
    token: str
    repo_url: str
    email: str
    name: str
    branch: str
    file_path_in_repo: str
    commit_message: str
    tag_name: str

    @field_validator("token", "repo_url", "email", "name", "branch", "file_path_in_repo", "commit_message", "tag_name")
    def validate_non_empty(cls, v):
        val = v.strip()
        if not val:
            raise ValueError("All deployment configuration fields must be provided")
        return val

