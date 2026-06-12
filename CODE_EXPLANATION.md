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
  * Returns the salt and key concatenated as hex strings: `salt_hex:key_hex` (e.g. `a1c2...:b4d5...`). This format allows verifying passwords without storing them in cleartext.
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
  * Formats keywords joined by semicolons (`;`).
  * If Business Unit is available, writes `ID|BU|Keywords`. If missing, writes `ID|Keywords`.
* **`FileService.load_feeds(file_path: str)`**:
  * Reads the entire keywords file line-by-line.
  * Skips empty lines and comment headers (lines starting with `#`).
  * Parses each valid row using `parse_line()` and returns a list of `FeedSchema` objects.
* **`FileService.save_feeds(file_path: str, feeds: List[FeedSchema])`**:
  * Writes feeds back to the disk.
  * Ensures that a thread-safe lock is acquired during write cycles to prevent concurrent write collisions.
  * Includes default header comments (`# ID|BU|Keywords` and `# ID|Keywords`).
* **`FileService.add_keyword(file_path, keyword, feed_name, add_to_clp, add_to_core)`**:
  * Loads all active feeds using `load_feeds()`.
  * Checks for duplicates: raises a `ValueError` if the keyword already exists in the target feed.
  * Appends the keyword to the target feed.
  * **Propagation checks**:
    * If `add_to_clp` is selected, appends it to the `CLP` special feed list.
    * If `add_to_core` is selected, appends it to the `CORE_LIST` core policy feed list.
  * Calls `save_feeds()` to commit changes to the user's sandboxed text file.
* **`FileService.remove_keyword_from_feed(file_path, keyword, feed_name)`**:
  * Loads active feeds, filters the selected keyword out of the target feed, and saves the file.
* **`FileService.remove_keyword_globally(file_path, keyword)`**:
  * Iterates through all feeds (including special rows like `CLP` and `CORE_LIST`) and deletes all occurrences of the keyword system-wide.

---

## 5. Diff Engine: [comparison_service.py](file:///Users/siddheshkotkar/Downloads/Screening_automator/backend/app/services/comparison_service.py)

### Purpose
Fetches baseline file content from the remote GitLab repository and performs detailed difference calculations.

### Key Components & Code explanation
* **`fetch_remote_file(url, token)`**:
  * Fires an HTTP GET request to retrieve raw file text from GitLab.
  * **SSL Certification bypass**: Configures a custom `ssl.SSLContext` setup using `ssl.CERT_NONE` to handle corporate proxies or self-signed certificate environments securely.
  * Attaches authorization headers if a token is configured.
  * If the URL contains `example.com` (default stub url), returns a mock baseline string simulating a remote file for offline development.
* **`compare_files(local_path, gitlab_url, token)`**:
  * Loads local sandboxed feeds via `FileService.load_feeds(local_path)`.
  * Retrieves remote GitLab file contents via `fetch_remote_file()` and parses them using `parse_content()`.
  * Organizes feeds into dictionaries mapping `FeedID -> Keywords`.
  * Computes diff analysis:
    * **Added Feeds**: Feeds present in local copy but missing in GitLab.
    * **Removed Feeds**: Feeds present in GitLab but missing in local copy.
    * **Modified Feeds**: Feeds present in both, but having difference in keywords. Computes exactly:
      * `added_keywords`: Keywords added in the local version.
      * `removed_keywords`: Keywords deleted from the local version.
    * **Unchanged Feeds**: Feeds with identical keyword lists.

---

## 6. Authentication & Sessions Router: [auth.py](file:///Users/siddheshkotkar/Downloads/Screening_automator/backend/app/routes/auth.py)

### Purpose
Declares the endpoint routes managing accounts, session creation, and downloads.

### Key Components & Code explanation
* **`POST /auth/signup`**:
  * Validates credentials length.
  * Checks if the username exists in the database.
  * Hashes password using `hash_password()` and saves record to the `users` table.
* **`POST /auth/login`**:
  * Fetches `password_hash` from the SQLite database.
  * Verifies credentials via `verify_password()`.
  * Registers session via `AuthService.create_session()`, returning the token UUID.
* **`POST /auth/logout`**:
  * Protected via token. Invalidation deletes the token row from the `sessions` database.
  * **Cleanup sandbox**: Deletes the session text file `keywords_session_{username}.txt` from the server disk.
* **`POST /session/initialize`**:
  * Triggers during the Source Selection phase on the frontend.
  * **Option `"master"`**: Fetches remote baseline from GitLab and writes it to `keywords_session_{username}.txt`.
  * **Option `"local"`**: Accepts an uploaded text file, validates the `ID|Keywords` headers, and serializes the clean parsed content as the local sandbox file.
* **`GET /session/download`**:
  * Protected endpoint returning `keywords_session_{username}.txt` as a downloadable attachment stream (`FileResponse`).

---

## 7. Keyword Actions Router: [feeds.py](file:///Users/siddheshkotkar/Downloads/Screening_automator/backend/app/routes/feeds.py)

### Purpose
Routes queries, additions, deletions, and comparisons.

### Core Endpoints & Dependency Injection
All routes inject `username: str = Depends(get_current_user)`.
* **`verify_session_file(username)`**:
  * Shared function checking if `keywords_session_{username}.txt` exists. If not, raises an HTTP 400 error indicating session workspace is uninitialized.
* **`GET /feeds`**:
  * Returns list of active feed names (IDs) inside the user's sandbox file.
* **`GET /feeds/all`**:
  * Returns full list of feeds and keywords details.
* **`POST /keywords/add`**:
  * Receives keyword addition details (feed name, propagation options).
  * Routes parameters directly to `FileService.add_keyword()`.
* **`POST /keywords/remove-from-feed`**:
  * Routes parameters directly to `FileService.remove_keyword_from_feed()`.
* **`POST /keywords/remove-completely`**:
  * Purges keywords globally via `FileService.remove_keyword_globally()`.
* **`GET /compare`**:
  * Passes the local user path and remote URL targets to the diff engine `ComparisonService.compare_files()`, returning a structured JSON diff report.

---

## 8. Root Server Entry Point: [main.py](file:///Users/siddheshkotkar/Downloads/Screening_automator/backend/app/main.py)

### Purpose
Configures the main web app gateway.

### Code Explanation
* **Startup Event Handler**:
  * Listens to server startup.
  * Triggers database tables creation and default credential checks by invoking `db_helper.init_db()`.
* **Middleware**:
  * Registers CORS middleware configuration allowing requests from the frontend client port (`5173`) to prevent browser blocking.
* **Router Registrations**:
  * Includes the authentication router (`app.routes.auth`) and keywords router (`app.routes.feeds`).
