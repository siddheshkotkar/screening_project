import os
import logging
from fastapi import APIRouter, HTTPException, Header, status, Depends, Form, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.config import settings
from app.utils.db import hash_password
from app.services.auth_service import AuthService, get_current_user, db_helper
from app.services.comparison_service import ComparisonService
from app.services.file_service import parse_line, serialize_feed

router = APIRouter()
logger = logging.getLogger(__name__)

# Base paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(BASE_DIR, "data")

def get_session_file_path(username: str) -> str:
    return os.path.join(DATA_DIR, f"keywords_session_{username}.txt")

class UserCredentials(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=50)

@router.post("/auth/signup")
def signup(payload: UserCredentials):
    """
    Registers a new user in the SQLite database.
    """
    username = payload.username.strip()
    password = payload.password
    
    with db_helper.get_connection() as conn:
        cursor = conn.execute("SELECT id FROM users WHERE username = ?", (username,))
        if cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Username '{username}' already exists."
            )
        
        hashed = hash_password(password)
        conn.execute(
            "INSERT INTO users (username, password_hash) VALUES (?, ?)",
            (username, hashed)
        )
        conn.commit()
        
    return {"status": "success", "message": "User registered successfully."}

@router.post("/auth/login")
def login(payload: UserCredentials):
    """
    Verifies user credentials and starts an active session.
    """
    from app.services.auth_service import verify_password
    
    username = payload.username.strip()
    password = payload.password
    
    with db_helper.get_connection() as conn:
        cursor = conn.execute("SELECT password_hash FROM users WHERE username = ?", (username,))
        row = cursor.fetchone()
        if not row or not verify_password(password, row["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password."
            )
            
    # Create session token
    token = AuthService.create_session(username)
    return {
        "status": "success",
        "token": token,
        "username": username
    }

@router.post("/auth/logout")
def logout(
    authorization: str = Header(...),
    username: str = Depends(get_current_user)
):
    """
    Removes session from DB and deletes the user's active session file from the server.
    """
    token = authorization.split(" ")[1].strip()
    AuthService.delete_session(token)
    
    # Delete temporary session file
    session_file = get_session_file_path(username)
    if os.path.exists(session_file):
        try:
            os.remove(session_file)
            logger.info(f"Cleaned up session file for user: {username}")
        except Exception as e:
            logger.error(f"Failed to delete session file {session_file}: {e}")
            
    return {"status": "success", "message": "Logged out and sandbox cleared."}

@router.post("/session/initialize")
def initialize_session(
    source: str = Form(...),
    file: UploadFile = None,
    username: str = Depends(get_current_user)
):
    """
    Initializes a user-sandboxed file using either GitLab (master) or a custom file upload.
    """
    session_file = get_session_file_path(username)
    os.makedirs(os.path.dirname(session_file), exist_ok=True)
    
    if source == "master":
        try:
            # Fetch remote GitLab baseline
            feeds = ComparisonService.fetch_remote_file(settings.gitlab_file_url, settings.gitlab_token)
            
            # Save remote baseline locally as the session file
            from app.services.file_service import FileService
            FileService.save_feeds(session_file, feeds)
            logger.info(f"Initialized master session file for {username}")
            return {"status": "success", "message": "Master file loaded successfully into session."}
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Failed to load master file from GitLab: {str(e)}"
            )
            
    elif source == "local":
        if not file:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File upload is required when selecting 'local' source."
            )
        try:
            content = file.file.read().decode("utf-8")
            
            # Loose validation on header
            first_line = content.splitlines()[0] if content.splitlines() else ""
            if "ID|" not in first_line or "Keywords|" not in first_line:
                raise ValueError("Uploaded file does not match the required ID|Keywords pipe-delimited header format.")
            
            # Parse and serialize content to normalize format and save
            feeds = ComparisonService.parse_content(content)
            from app.services.file_service import FileService
            FileService.save_feeds(session_file, feeds)
            
            logger.info(f"Uploaded and initialized local session file for {username}")
            return {"status": "success", "message": "Local file uploaded successfully."}
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to parse uploaded file: {str(e)}"
            )
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid source selection: {source}"
        )

@router.get("/session/download")
def download_session(username: str = Depends(get_current_user)):
    """
    Downloads the active session file.
    """
    session_file = get_session_file_path(username)
    if not os.path.exists(session_file):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active session file found. Please select a source first."
        )
    return FileResponse(
        path=session_file,
        media_type="text/plain",
        filename="keywords.txt"
    )
