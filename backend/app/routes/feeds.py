import os
from fastapi import APIRouter, HTTPException, Depends, status
from typing import List

from app.config import settings
from app.models.schemas import (
    FeedSchema,
    FeedKeywordsResponse,
    KeywordAddRequest,
    KeywordAddMultipleRequest,
    KeywordRemoveFeedRequest,
    KeywordRemoveMultipleRequest,
    KeywordRemoveCompleteRequest,
    CompareResponse,
    DeployRequest
)
from app.services.file_service import FileService
from app.services.comparison_service import ComparisonService
from app.services.deploy_service import DeployService
from app.services.auth_service import get_current_user
from app.routes.auth import get_session_file_path

router = APIRouter()

def verify_session_file(username: str) -> str:
    """
    Checks if the user has an initialized session file and returns its path.
    """
    session_file = get_session_file_path(username)
    if not os.path.exists(session_file):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session not initialized. Please select a file source."
        )
    return session_file

@router.get("/feeds", response_model=List[str])
def get_feeds(username: str = Depends(get_current_user)):
    """
    Returns all feed names (IDs) from the user's active session file.
    """
    session_file = verify_session_file(username)
    try:
        feeds = FileService.load_feeds(session_file)
        return [feed.id for feed in feeds]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error reading feeds: {str(e)}"
        )

@router.get("/feeds/all", response_model=List[FeedSchema])
def get_all_feeds(username: str = Depends(get_current_user)):
    """
    Returns all feeds along with their keywords and details.
    """
    session_file = verify_session_file(username)
    try:
        return FileService.load_feeds(session_file)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error loading all feeds: {str(e)}"
        )

@router.get("/feeds/{feed_name}/keywords", response_model=FeedKeywordsResponse)
def get_feed_keywords(feed_name: str, username: str = Depends(get_current_user)):
    """
    Returns the keywords list for a specific feed.
    """
    session_file = verify_session_file(username)
    try:
        feed = FileService.get_feed_by_name(session_file, feed_name)
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
def add_keyword(payload: KeywordAddRequest, username: str = Depends(get_current_user)):
    """
    Adds a keyword to a specific feed in the user's sandbox session.
    """
    session_file = verify_session_file(username)
    try:
        updated_feed = FileService.add_keyword(
            file_path=session_file,
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

@router.post("/keywords/add-multiple")
def add_keyword_multiple(payload: KeywordAddMultipleRequest, username: str = Depends(get_current_user)):
    """
    Adds a keyword to multiple feeds in the user's sandbox session.
    """
    session_file = verify_session_file(username)
    try:
        updated_feeds = FileService.add_keyword_to_multiple_feeds(
            file_path=session_file,
            keyword=payload.keyword,
            feed_names=payload.feed_names,
            add_to_clp=payload.add_to_clp,
            add_to_core=payload.add_to_core
        )
        return {"status": "success", "message": f"Successfully added keyword to {len(updated_feeds)} feeds.", "feeds": updated_feeds}
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add keyword to multiple feeds: {str(e)}"
        )

@router.post("/keywords/remove-from-feed")
def remove_keyword_from_feed(payload: KeywordRemoveFeedRequest, username: str = Depends(get_current_user)):
    """
    Removes a keyword only from the selected feed.
    """
    session_file = verify_session_file(username)
    try:
        FileService.remove_keyword_from_feed(
            file_path=session_file,
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

@router.post("/keywords/remove-from-multiple-feeds")
def remove_keyword_from_multiple_feeds_route(payload: KeywordRemoveMultipleRequest, username: str = Depends(get_current_user)):
    """
    Removes a keyword from multiple feeds in the user's sandbox session.
    """
    session_file = verify_session_file(username)
    try:
        FileService.remove_keyword_from_multiple_feeds(
            file_path=session_file,
            keyword=payload.keyword,
            feed_names=payload.feed_names
        )
        return {"status": "success", "message": f"Successfully removed keyword '{payload.keyword}' from {len(payload.feed_names)} feeds."}
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(ve)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to remove keyword from multiple feeds: {str(e)}"
        )

@router.post("/keywords/remove-completely")
def remove_keyword_completely(payload: KeywordRemoveCompleteRequest, username: str = Depends(get_current_user)):
    """
    Removes a keyword globally from all feeds and special lists in the user's sandbox session.
    """
    session_file = verify_session_file(username)
    try:
        FileService.remove_keyword_globally(
            file_path=session_file,
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
def compare_local_with_gitlab(username: str = Depends(get_current_user)):
    """
    Compares the user's active session file with the remote GitLab file.
    """
    session_file = verify_session_file(username)
    try:
        url = settings.gitlab_file_url
        if not url:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="GITLAB_FILE_URL configuration is missing."
            )
        
        diff_result = ComparisonService.compare_files(
            local_path=session_file,
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

@router.post("/deploy/gitlab-uat")
def deploy_to_gitlab_uat(payload: DeployRequest, username: str = Depends(get_current_user)):
    """
    Deploys the user's sandbox session file to GitLab UAT repository by cloning,
    checking out a branch, committing, tagging, and pushing changes.
    """
    session_file = verify_session_file(username)
    try:
        result = DeployService.deploy_to_gitlab(
            session_file_path=session_file,
            jira_num=payload.jira_num,
            branch=payload.branch,
            commit_message=payload.commit_message,
            tag_name=payload.tag_name
        )
        if result["status"] == "error":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result["message"]
            )
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Deployment operation failed: {str(e)}"
        )

