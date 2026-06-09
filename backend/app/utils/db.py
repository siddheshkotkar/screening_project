import os
import sqlite3
import hashlib
import logging

logger = logging.getLogger(__name__)

# Simple salt-based PBKDF2 password hashing
def hash_password(password: str) -> str:
    salt = os.urandom(16)
    key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
    return salt.hex() + ":" + key.hex()

class DatabaseHelper:
    def __init__(self, db_path: str):
        self.db_path = db_path
        # Ensure data folder exists
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        self.init_db()

    def get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def init_db(self):
        """
        Creates users and sessions tables, and seeds the master user.
        """
        with self.get_connection() as conn:
            # Create users table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL
                )
            """)
            # Create sessions table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS sessions (
                    token TEXT PRIMARY KEY,
                    username TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.commit()

            # Seed master user if users table is empty
            cursor = conn.execute("SELECT COUNT(*) as count FROM users")
            row = cursor.fetchone()
            if row["count"] == 0:
                logger.info("Database is empty. Seeding master_user...")
                hashed = hash_password("password123")
                conn.execute(
                    "INSERT INTO users (username, password_hash) VALUES (?, ?)",
                    ("master_user", hashed)
                )
                conn.commit()
                logger.info("Successfully seeded master_user / password123")
