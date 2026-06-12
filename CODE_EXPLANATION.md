# Screening Automator - Backend Code Implementation Details

This document provides a detailed, code-level explanation of the entire **FastAPI Backend** codebase, walking through every file, class, function, and database query to explain exactly *what is happening where* and *how it functions*.

---

## 1. Application Config: [config.py](file:///Users/siddheshkotkar/Downloads/Screening_automator/backend/app/config.py)

### Purpose
Manages configurations and environment variables via Pydantic.

### Code Explanation
* **`Settings` Class**: Inherits from `BaseSettings` (from `pydantic-settings`).
* **Environment Fields**:
  * `gitlab_file_url`: The remote GitLab keywords baseline URL (`https://gitlab.com/...`). If configured with a mock domain (like `example.com`), the application loads stub baseline values for local validation.
  * `gitlab_token`: Header token used to authenticate calls with the GitLab API.
  * `port`: Backend server port (defaults to `8000`).
* **`.env` Integration**: The inner `Config` class instructs Pydantic to read configuration baselines from the `.env` file located in the backend folder.

---

## 2. Database Core: [db.py](file:///Users/siddheshkotkar/Downloads/Screening_automator/backend/app/utils/db.py)

### Purpose
Initializes the SQLite3 local database, constructs the schemas, and seeds the initial user credentials.

### Key Components & Code explanation
* **`hash_password(password: str)`**:
  * Generates a random 16-byte salt via `os.urandom(16)`.
  * Computes a secure hash of the password using **PBKDF2-HMAC-SHA256** with `100,000` iterations.
  * Returns the salt and key concatenated as hex strings: `salt_hex:key_hex`. This format allows verifying passwords without storing them in cleartext.
* **`DatabaseHelper` Class**:
  * `__init__(self, db_path: str)`: Configures the location of the `.db` file (saved under `backend/data/users.db`).
  * `get_connection(self)`: Context manager yielding an active sqlite3 connection. It sets `row_factory = sqlite3.Row` so query results return as key-value structures rather than raw index tuples.
  * `init_db(self)`:
    * Creates the **`users`** table if it does not exist (`id`, `username` UNIQUE, `password_hash`).
    * Creates the **`sessions`** table if it does not exist (`token` PRIMARY KEY, `username`, `created_at` timestamp).
    * **Master Seed logic**: Queries the `users` table. If empty, hashes the string `"password123"` using `hash_password()` and inserts username `"master_user"` to establish an instant login account.

---

## 3. Session Security & Dependency Injector: [auth_service.py](file:///Users/siddheshkotkar/Downloads/Screening_automator/backend/app/services/auth_service.py)

### Purpose
Handles user validation checks and exports the core authentication interceptor dependency.

### Key Components & Code explanation
* **`verify_password(password: str, hashed: str)`**:
  * Extracts the `salt` and `key` from the database `salt:key` hex string.
  * Computes the PBKDF2 hash of the incoming password using the exact same salt and iteration parameters.
  * Returns `True` if the resulting hash keys match.
* **`AuthService.create_session(username: str)`**:
  * Generates a random UUID string via `uuid.uuid4()`.
  * Inserts the token and username into the database `sessions` table to keep trace of the login session.
  * Returns the token string.
* **`AuthService.delete_session(token: str)`**:
  * Deletes the session row from the SQLite database, effectively invalidating the token.
* **`get_current_user(authorization: str = Header(...))` dependency**:
  * Standard FastAPI dependency. It automatically extracts the HTTP header key `Authorization`.
  * Parses out the token string (extracting it from the `Bearer <token>` format).
  * Queries the SQLite database: `SELECT username FROM sessions WHERE token = ?`.
  * If the token does not exist, raises an `HTTP 401 Unauthorized` exception, instantly blocking unauthorized access.
  * If the token is valid, returns the active `username` string.

---

## 4. File I/O Engine: [file_service.py](file:///Users/siddheshkotkar/Downloads/Screening_automator/backend/app/services/file_service.py)

### Purpose
Manages thread-safe parsing, formatting, propagation, and writing of pipe-delimited configurations (`ID|Keywords` format).

### Key Components & Code explanation
* **`parse_line(line: str)`**:
  * Parses a line from the file.
  * Strips spaces, splits columns by the pipe (`|`) delimiter.
  * If the row has 3 columns (e.g. `Barclaycard_BPAID|Barclaycard Business Payments|OFAC;EU`), splits keywords by semicolon (`;`) and returns a `FeedSchema` model containing `id`, `bu`, and `keywords`.
  * If the row has 2 columns (such as `CLP` or `CORE_LIST` lists), parses it with `bu=None` and keywords split by `;`.
* **`serialize_feed(feed: FeedSchema)`**:
  * Converts the internal Python `FeedSchema` structure back into a pipe-delimited text line.
* **`FileService.load_feeds(file_path: str)`**:
  * Reads the entire keywords file line-by-line.
  * Skips empty lines and comment headers (lines starting with `#`).
  * Parses each valid row using `parse_line()` and returns a list of `FeedSchema` objects.
* **`FileService.save_feeds(file_path: str, feeds: List[FeedSchema])`**:
  * Writes feeds back to the disk.
  * Ensures that a thread-safe lock is acquired during write cycles to prevent concurrent write collisions.
* **`FileService.add_keyword(...)`**:
  * Adds a keyword to a target feed, checking for duplicates. Optionally propagates the keyword to special lists (`CLP`, `CORE_LIST`).
* **`FileService.add_keyword_to_multiple_feeds(...)`**:
  * Adds a keyword to multiple feeds, validating that all target feeds exist and check for duplicate collisions. Optionally propagates to `CLP` and `CORE_LIST`.
* **`FileService.remove_keyword_from_feed(...)`**:
  * Removes a keyword from a specific feed.
* **`FileService.remove_keyword_globally(...)`**:
  * Iterates through all feeds (including special rows like `CLP` and `CORE_LIST`) and deletes all occurrences of the keyword system-wide.

---

## 5. Diff Engine: [comparison_service.py](file:///Users/siddheshkotkar/Downloads/Screening_automator/backend/app/services/comparison_service.py)

### Purpose
Fetches baseline file content from the remote GitLab repository and performs detailed difference calculations.

### Key Components & Code explanation
* **`fetch_remote_file(url, token)`**:
  * Fires an HTTP GET request to retrieve raw file text from GitLab.
  * Configures a custom `ssl.SSLContext` setup using `ssl.CERT_NONE` to handle corporate proxies or self-signed certificate environments securely.
* **`compare_files(local_path, gitlab_url, token)`**:
  * Loads local sandboxed feeds via `FileService.load_feeds(local_path)`.
  * Retrieves remote GitLab file contents and computes Added, Removed, and Modified feeds/keywords.

---

## 6. Authentication & Sessions Router: [auth.py](file:///Users/siddheshkotkar/Downloads/Screening_automator/backend/app/routes/auth.py)

### Purpose
Declares the endpoint routes managing accounts, session creation, and downloads.

### Key Components & Code explanation
* **`POST /auth/signup`**:
  * Hashes password using `hash_password()` and saves record to the `users` table.
* **`POST /auth/login`**:
  * Verifies credentials and registers session via `AuthService.create_session()`, returning the token UUID.
* **`POST /auth/logout`**:
  * Protected via token. Invalidation deletes the token row from the `sessions` database and deletes the user's `keywords_session_{username}.txt` sandbox file.
* **`POST /session/initialize`**:
  * Instantiates the user's sandbox file from GitLab (Option `"master"`) or uploaded text files (Option `"local"`).
* **`GET /session/download`**:
  * Streams the user's active session text file as a downloadable attachment stream (`FileResponse`).

---

## 7. Keyword Actions Router: [feeds.py](file:///Users/siddheshkotkar/Downloads/Screening_automator/backend/app/routes/feeds.py)

### Purpose
Routes queries, additions, deletions, and comparisons.

### Core Endpoints & Dependency Injection
All routes inject `username: str = Depends(get_current_user)`.
* **`GET /feeds`**: Returns list of active feed names (IDs).
* **`GET /feeds/all`**: Returns full list of feeds and keywords details.
* **`POST /keywords/add`**: Add a keyword to a single feed.
* **`POST /keywords/add-multiple`**: Add a keyword to multiple target feeds simultaneously (validates that all selected feeds exist and are free from duplication).
* **`POST /keywords/remove-from-feed`**: Remove a keyword from a single feed.
* **`POST /keywords/remove-completely`**: Purge keywords globally.
* **`GET /compare`**: Diff local user path and remote URL targets, returning a JSON report.

---

## 8. Root Server Entry Point: [main.py](file:///Users/siddheshkotkar/Downloads/Screening_automator/backend/app/main.py)

### Purpose
Configures the main web app gateway.
* Configures database tables startup, CORS permissions, and routes bindings.
