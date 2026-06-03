# Screening Automator

A full-stack application built to parse, search, manage, and compare feed-to-keyword mappings stored in a server-side text file. It supports adding and removing keywords (with propagation to special lists like `CLP` and `CORE_LIST`) and running comparison analysis against a remote GitLab repository file version.

## Project Structure

```
Screening_automator/
├── backend/
│   ├── app/
│   │   ├── models/
│   │   │   └── schemas.py          # Request and Response schemas
│   │   ├── routes/
│   │   │   └── feeds.py            # API routers & endpoints
│   │   ├── services/
│   │   │   ├── comparison_service.py # Fetches remote file & diffs data
│   │   │   └── file_service.py     # Thread-safe pipe-delimited I/O utility
│   │   ├── tests/
│   │   │   └── test_logic.py       # pytest unit test suite
│   │   ├── config.py               # Pydantic Settings loader
│   │   └── main.py                 # FastAPI application root entry point
│   ├── data/
│   │   └── keywords.txt            # Local database of truth
│   ├── .env                        # Configuration variables
│   └── requirements.txt            # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Modal.jsx           # Reusable confirmation/checklist modal
│   │   │   ├── Navbar.jsx          # Dashboard navigation header
│   │   │   └── Toast.jsx           # Slide-in notifications
│   │   ├── pages/
│   │   │   ├── Home.jsx            # Homepage dashboard layout
│   │   │   ├── ViewAll.jsx         # Table view of all feeds with search
│   │   │   ├── ViewSpecific.jsx    # Feed selector and chip tags explorer
│   │   │   ├── UpdateFile.jsx      # Add/Remove keyword tabs and validations
│   │   │   └── CompareFiles.jsx    # Compare summary, color-coded diffs, JSON export
│   │   ├── services/
│   │   │   └── api.js              # Axios configuration
│   │   ├── App.jsx                 # Routing and layout wrapper
│   │   ├── App.css                 # Premium custom styles & layouts
│   │   ├── index.css               # CSS variables, typography, reset
│   │   └── main.jsx                # React app mounting root
│   ├── index.html                  # Core HTML template with SEO tags
│   ├── package.json                # Frontend package scripts
│   └── vite.config.js              # Vite bundler options
└── README.md                       # This documentation file
```

---

## Getting Started

### Prerequisites
- Python 3.9+
- Node.js 18+ and npm

---

### Step 1: Run the Backend

1. Navigate to the `backend` directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment and activate it:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

3. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Config the `.env` file variables (a default `.env` is already configured in the folder):
   - `GITLAB_FILE_URL`: The URL to fetch the remote file for comparison. (If this URL contains `example.com`, the app will automatically return a mock GitLab file content for offline development and validation).

5. Start the FastAPI server:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```
   The API will be available at `http://localhost:8000` with Swagger docs at `http://localhost:8000/docs`.

---

### Step 2: Run the Frontend

1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```

2. Install the packages:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   The application will be running at `http://localhost:5173`.

---

### Run Tests

To verify that the file parsing, duplicate validations, propagation, deletion, and comparison engine functions are all working correctly, run the pytest suite from the root folder:

```bash
PYTHONPATH=backend ./venv/bin/pytest backend/app/tests/
```

---

## API Endpoints Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/feeds` | Returns a list of all feed names (IDs) |
| `GET` | `/feeds/all` | Returns all feeds along with their keywords and details |
| `GET` | `/feeds/{feed_name}/keywords` | Returns the list of keywords assigned to a specific feed |
| `POST` | `/keywords/add` | Adds a keyword to a feed (with optional CLP/CORE_LIST flags) |
| `POST` | `/keywords/remove-from-feed` | Removes a keyword from a single feed |
| `POST` | `/keywords/remove-completely` | Deletes a keyword globally from all lists |
| `GET` | `/compare` | Performs diff between local file and `GITLAB_FILE_URL` |
