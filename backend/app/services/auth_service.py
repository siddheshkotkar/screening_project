import os
import uuid
import hashlib
from fastapi import Header, HTTPException, status
from app.utils.db import DatabaseHelper

# Define DB path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(BASE_DIR, "data", "users.db")

db_helper = DatabaseHelper(DB_PATH)

def verify_password(password: str, hashed: str) -> bool:
    try:
        salt_hex, key_hex = hashed.split(":")
        salt = bytes.fromhex(salt_hex)
        key = bytes.fromhex(key_hex)
        new_key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
        return key == new_key
    except Exception:
        return False

class AuthService:
    @staticmethod
    def create_session(username: str) -> str:
        """
        Creates a new session token, saves it to database, and returns it.
        """
        token = str(uuid.uuid4())
        with db_helper.get_connection() as conn:
            conn.execute(
                "INSERT INTO sessions (token, username) VALUES (?, ?)",
                (token, username)
            )
            conn.commit()
        return token

    @staticmethod
    def delete_session(token: str) -> None:
        """
        Deletes a session token from database.
        """
        with db_helper.get_connection() as conn:
            conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
            conn.commit()

    @staticmethod
    def get_username_by_token(token: str) -> str:
        """
        Verifies token and returns corresponding username, or raises exception.
        """
        with db_helper.get_connection() as conn:
            cursor = conn.execute(
                "SELECT username FROM sessions WHERE token = ?",
                (token,)
            )
            row = cursor.fetchone()
            if not row:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid session token or session expired."
                )
            return row["username"]

def get_current_user(authorization: str = Header(..., description="Bearer token")) -> str:
    """
    FastAPI dependency that extracts Bearer token, validates it against SQLite sessions,
    and returns the authenticated username.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header must start with 'Bearer '"
        )
    
    token = authorization.split(" ")[1].strip()
    return AuthService.get_username_by_token(token)
