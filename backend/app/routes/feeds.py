import os
from fastapi import APIRouter, HTTPException, Query, status
from typing import List

from app.config import settings
from app.models.schemas import (
    FeedSchema,
    FeedKeywordsResponse,
    KeywordAddRequest,
    KeywordRemoveFeedRequest,
    KeywordRemoveCompleteRequest,
    CompareResponse
)
from app.services.file_service import FileService
from app.services.comparison_service import ComparisonService

router = APIRouter()

# Get local keywords file path relative to this file
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LOCAL_FILE_PATH = os.path.join(BASE_DIR, "data", "keywords.txt")

@router.get("/feeds", response_model=List[str])
def get_feeds():
    """
    Returns all feed names (IDs) from the local file.
    """
    try:
        feeds = FileService.load_feeds(LOCAL_FILE_PATH)
        return [feed.id for feed in feeds]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error reading feeds: {str(e)}"
        )

@router.get("/feeds/all", response_model=List[FeedSchema])
def get_all_feeds():
    """
    Returns all feeds along with their keywords and details.
    """
    try:
        return FileService.load_feeds(LOCAL_FILE_PATH)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error loading all feeds: {str(e)}"
        )

@router.get("/feeds/{feed_name}/keywords", response_model=FeedKeywordsResponse)
def get_feed_keywords(feed_name: str):
    """
    Returns the keywords list for a specific feed.
    """
    try:
        feed = FileService.get_feed_by_name(LOCAL_FILE_PATH, feed_name)
        if not feed:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Feed '{feed_name}' not found."
            )
        return FeedKeywordsResponse(feed_name=feed.id, keywords=feed.keywords)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching keywords: {str(e)}"
        )

@router.post("/keywords/add", response_model=FeedSchema)
def add_keyword(payload: KeywordAddRequest):
    """
    Adds a keyword to a specific feed, and optionally to CLP and CORE_LIST if requested.
    """
    try:
        updated_feed = FileService.add_keyword(
            file_path=LOCAL_FILE_PATH,
            keyword=payload.keyword,
            feed_name=payload.feed_name,
            add_to_clp=payload.add_to_clp,
            add_to_core=payload.add_to_core
        )
        return updated_feed
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add keyword: {str(e)}"
        )

@router.post("/keywords/remove-from-feed")
def remove_keyword_from_feed(payload: KeywordRemoveFeedRequest):
    """
    Removes a keyword only from the selected feed.
    """
    try:
        FileService.remove_keyword_from_feed(
            file_path=LOCAL_FILE_PATH,
            keyword=payload.keyword,
            feed_name=payload.feed_name
        )
        return {"status": "success", "message": f"Keyword '{payload.keyword}' removed from feed '{payload.feed_name}'."}
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to remove keyword: {str(e)}"
        )

@router.post("/keywords/remove-completely")
def remove_keyword_completely(payload: KeywordRemoveCompleteRequest):
    """
    Removes a keyword globally from all feeds and special lists.
    """
    try:
        FileService.remove_keyword_globally(
            file_path=LOCAL_FILE_PATH,
            keyword=payload.keyword
        )
        return {"status": "success", "message": f"Keyword '{payload.keyword}' removed globally from all feeds and special lists."}
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to remove keyword globally: {str(e)}"
        )

@router.get("/compare", response_model=CompareResponse)
def compare_local_with_gitlab():
    """
    Compares the local file with the remote GitLab file.
    """
    try:
        url = settings.gitlab_file_url
        if not url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="GITLAB_FILE_URL configuration is missing."
            )
        
        diff_result = ComparisonService.compare_files(
            local_path=LOCAL_FILE_PATH,
            gitlab_url=url,
            token=settings.gitlab_token
        )
        return diff_result
    except RuntimeError as re:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(re)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Comparison failed: {str(e)}"
        )
