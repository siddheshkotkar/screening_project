import os
import tempfile
import pytest
from app.models.schemas import FeedSchema
from app.services.file_service import FileService, parse_line, serialize_feed
from app.services.comparison_service import ComparisonService

TEST_DATA = """ID|Keywords|BU|Public|Private
CLP|OFAC~EU~UN|CLP||
CORE_LIST|OFAC~EU|Core Policy Keywords||
Barclaycard_BPAID|OFAC~EU~UKHO|Barclaycard core||
Barclaycard_BPAY|OFAC~EU|Barclaycard core||
"""

@pytest.fixture
def temp_keywords_file():
    fd, path = tempfile.mkstemp(suffix=".txt", prefix="keywords_test_")
    os.close(fd)
    with open(path, "w", encoding="utf-8") as f:
        f.write(TEST_DATA)
    yield path
    if os.path.exists(path):
        os.remove(path)

def test_parse_line():
    line = "Barclaycard_BPAID|OFAC~EU~UKHO|Barclaycard core|pub|priv"
    parsed = parse_line(line)
    assert parsed is not None
    assert parsed.id == "Barclaycard_BPAID"
    assert parsed.keywords == ["OFAC", "EU", "UKHO"]
    assert parsed.bu == "Barclaycard core"
    assert parsed.public == "pub"
    assert parsed.private == "priv"

def test_serialize_feed():
    feed = FeedSchema(
        id="TestFeed",
        keywords=["KEY1", "KEY2"],
        bu="TestBU",
        public="Y",
        private="N"
    )
    serialized = serialize_feed(feed)
    assert serialized == "TestFeed|KEY1~KEY2|TestBU|Y|N"

def test_load_feeds(temp_keywords_file):
    feeds = FileService.load_feeds(temp_keywords_file)
    assert len(feeds) == 4
    assert feeds[0].id == "CLP"
    assert feeds[1].id == "CORE_LIST"
    assert feeds[2].id == "Barclaycard_BPAID"
    assert feeds[3].id == "Barclaycard_BPAY"

def test_keyword_exists(temp_keywords_file):
    assert FileService.keyword_exists_in_feed(temp_keywords_file, "CLP", "OFAC") is True
    assert FileService.keyword_exists_in_feed(temp_keywords_file, "CLP", "NOT_EXIST") is False
    assert FileService.keyword_exists_anywhere(temp_keywords_file, "UKHO") is True
    assert FileService.keyword_exists_anywhere(temp_keywords_file, "RANDOM_XYZ") is False

def test_add_keyword_existing_feed(temp_keywords_file):
    # Add new keyword to Barclaycard_BPAY
    FileService.add_keyword(temp_keywords_file, "NEW_KEY", "Barclaycard_BPAY")
    
    # Check it exists now
    assert FileService.keyword_exists_in_feed(temp_keywords_file, "Barclaycard_BPAY", "NEW_KEY") is True
    
    # Verify it doesn't duplicate in CLP/CORE_LIST since we didn't specify the flags
    assert FileService.keyword_exists_in_feed(temp_keywords_file, "CLP", "NEW_KEY") is False

def test_add_keyword_duplicate_error(temp_keywords_file):
    # Verify error on duplicate addition
    with pytest.raises(ValueError, match="already exists"):
        FileService.add_keyword(temp_keywords_file, "OFAC", "Barclaycard_BPAY")

def test_add_keyword_with_special_lists(temp_keywords_file):
    # Add keyword and propagate to CLP and CORE_LIST
    FileService.add_keyword(
        temp_keywords_file, 
        keyword="SUPER_NEW", 
        feed_name="Barclaycard_BPAY", 
        add_to_clp=True, 
        add_to_core=True
    )
    
    # Verify it exists in all three
    assert FileService.keyword_exists_in_feed(temp_keywords_file, "Barclaycard_BPAY", "SUPER_NEW") is True
    assert FileService.keyword_exists_in_feed(temp_keywords_file, "CLP", "SUPER_NEW") is True
    assert FileService.keyword_exists_in_feed(temp_keywords_file, "CORE_LIST", "SUPER_NEW") is True

def test_remove_keyword_from_feed(temp_keywords_file):
    # Remove UKHO from Barclaycard_BPAID
    FileService.remove_keyword_from_feed(temp_keywords_file, "UKHO", "Barclaycard_BPAID")
    assert FileService.keyword_exists_in_feed(temp_keywords_file, "Barclaycard_BPAID", "UKHO") is False
    
    # Verify rest of the file is unchanged (e.g. CLP still has OFAC/EU)
    assert FileService.keyword_exists_in_feed(temp_keywords_file, "CLP", "OFAC") is True

def test_remove_keyword_globally(temp_keywords_file):
    # Remove EU globally
    FileService.remove_keyword_globally(temp_keywords_file, "EU")
    
    # Verify gone everywhere
    feeds = FileService.load_feeds(temp_keywords_file)
    for feed in feeds:
        assert "EU" not in feed.keywords

def test_comparison_logic(temp_keywords_file):
    # Setup comparison mock remote content (matches local except Barclaycard_BPAY is modified, Deprecated is in GitLab but not local)
    mock_gitlab = """ID|Keywords|BU|Public|Private
CLP|OFAC~EU~UN|CLP||
CORE_LIST|OFAC~EU|Core Policy Keywords||
Barclaycard_BPAID|OFAC~EU~UKHO|Barclaycard core||
Barclaycard_BPAY|OFAC~EU~GITLAB_EXTRA|Barclaycard core||
Old_Deprecated_Feed|SOME_OLD_KEYWORD|Deprecated BU||
"""
    # Write mock GitLab file
    fd, gitlab_path = tempfile.mkstemp(suffix=".txt", prefix="gitlab_mock_")
    os.close(fd)
    with open(gitlab_path, "w", encoding="utf-8") as f:
        f.write(mock_gitlab)
        
    try:
        # Load and compare
        local_feeds = FileService.load_feeds(temp_keywords_file)
        gitlab_feeds = ComparisonService.parse_content(mock_gitlab)
        
        # Manually compute compare with the service parsing method
        diff_result = ComparisonService.compare_files(temp_keywords_file, f"file://{gitlab_path}")
        
        # Barclaycard_BPAY should be modified (GitLab has GITLAB_EXTRA)
        bpay_diff = next(d for d in diff_result.details if d.feed_name == "Barclaycard_BPAY")
        assert bpay_diff.status == "modified"
        assert bpay_diff.removed_keywords == ["GITLAB_EXTRA"] # in gitlab but not local
        assert bpay_diff.added_keywords == []
        
        # Old_Deprecated_Feed is in GitLab but not local -> status removed (from local's perspective)
        deprecated_diff = next(d for d in diff_result.details if d.feed_name == "Old_Deprecated_Feed")
        assert deprecated_diff.status == "removed"
        
    finally:
        if os.path.exists(gitlab_path):
            os.remove(gitlab_path)

def test_password_hashing():
    from app.services.auth_service import verify_password
    from app.utils.db import hash_password
    
    password = "test_secure_password"
    hashed = hash_password(password)
    
    assert verify_password(password, hashed) is True
    assert verify_password("wrong_password", hashed) is False

def test_database_helper_seeding():
    from app.utils.db import DatabaseHelper
    from app.services.auth_service import verify_password
    
    # Create temp DB file
    fd, path = tempfile.mkstemp(suffix=".db", prefix="users_test_")
    os.close(fd)
    
    try:
        db = DatabaseHelper(path)
        
        # Verify master user was seeded
        with db.get_connection() as conn:
            cursor = conn.execute("SELECT username, password_hash FROM users WHERE username = 'master_user'")
            row = cursor.fetchone()
            assert row is not None
            assert row["username"] == "master_user"
            assert verify_password("password123", row["password_hash"]) is True
    finally:
        if os.path.exists(path):
            os.remove(path)

def test_session_lifecycle():
    from app.utils.db import DatabaseHelper
    from app.services.auth_service import AuthService
    import app.services.auth_service as auth_service
    
    fd, path = tempfile.mkstemp(suffix=".db", prefix="users_test_")
    os.close(fd)
    
    try:
        # Swap db_helper inside auth_service with test db helper
        original_helper = auth_service.db_helper
        test_helper = DatabaseHelper(path)
        auth_service.db_helper = test_helper
        
        username = "auth_test_user"
        token = AuthService.create_session(username)
        
        assert token is not None
        # Check mapping resolves
        resolved = AuthService.get_username_by_token(token)
        assert resolved == username
        
        # Delete session
        AuthService.delete_session(token)
        
        # Checking now should raise exception
        with pytest.raises(Exception):
            AuthService.get_username_by_token(token)
            
        # Restore helper
        auth_service.db_helper = original_helper
    finally:
        if os.path.exists(path):
            os.remove(path)

def test_add_keyword_multiple_feeds(temp_keywords_file):
    # Add new keyword to both Barclaycard_BPAY and Barclaycard_BPAID
    FileService.add_keyword_to_multiple_feeds(
        temp_keywords_file, 
        keyword="MULTI_KEY", 
        feed_names=["Barclaycard_BPAY", "Barclaycard_BPAID"]
    )
    
    # Check it exists in both
    assert FileService.keyword_exists_in_feed(temp_keywords_file, "Barclaycard_BPAY", "MULTI_KEY") is True
    assert FileService.keyword_exists_in_feed(temp_keywords_file, "Barclaycard_BPAID", "MULTI_KEY") is True
    
    # Verify error on duplicate addition to either
    with pytest.raises(ValueError, match="already exists"):
        FileService.add_keyword_to_multiple_feeds(
            temp_keywords_file, 
            keyword="MULTI_KEY", 
            feed_names=["Barclaycard_BPAY", "CORE_LIST"]
        )

    # Add keyword to multiple feeds with CLP propagation
    FileService.add_keyword_to_multiple_feeds(
        temp_keywords_file,
        keyword="CLP_MULTI",
        feed_names=["Barclaycard_BPAY", "Barclaycard_BPAID"],
        add_to_clp=True
    )
    assert FileService.keyword_exists_in_feed(temp_keywords_file, "CLP", "CLP_MULTI") is True

def test_remove_keyword_multiple_feeds(temp_keywords_file):
    # Barclaycard_BPAY and Barclaycard_BPAID both have "EU" by default
    # Let's remove "EU" from both
    FileService.remove_keyword_from_multiple_feeds(
        temp_keywords_file,
        keyword="EU",
        feed_names=["Barclaycard_BPAY", "Barclaycard_BPAID"]
    )
    
    # Verify keyword is gone from both
    assert FileService.keyword_exists_in_feed(temp_keywords_file, "Barclaycard_BPAY", "EU") is False
    assert FileService.keyword_exists_in_feed(temp_keywords_file, "Barclaycard_BPAID", "EU") is False
    
    # Verify exception if trying to remove non-existent keyword from one of them
    with pytest.raises(ValueError, match="not found"):
        FileService.remove_keyword_from_multiple_feeds(
            temp_keywords_file,
            keyword="EU",
            feed_names=["Barclaycard_BPAY", "CLP"]
        )

def test_deploy_to_gitlab_uat(temp_keywords_file):
    from unittest.mock import patch, MagicMock
    from app.services.deploy_service import DeployService
    
    # Mock subprocess.run and httpx.get
    with patch("subprocess.run") as mock_run, patch("httpx.get") as mock_http:
        # Mock httpx response for user details
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "email": "project_16293_bot_709f42e645c9665686ada9227cf4a670@noreply.app.gitlab.barcapint.com",
            "username": "project_16293_bot"
        }
        mock_http.return_value = mock_resp

        mock_proc = MagicMock()
        mock_proc.returncode = 0
        mock_proc.stdout = "Success"
        mock_proc.stderr = ""
        mock_run.return_value = mock_proc
        
        result = DeployService.deploy_to_gitlab(
            session_file_path=temp_keywords_file,
            jira_num="GCWS-31803",
            branch="feature/Keyword_Auto_V5",
            commit_message="GCWS-31803",
            tag_name="delta_build_GCWS-31803V5"
        )
        
        assert result["status"] == "success"
        assert "Successfully deployed to branch" in result["message"]
        # Confirm git clone and branch checkout were invoked
        flat_args = [arg for call in mock_run.call_args_list for arg in call[0][0]]
        assert "clone" in flat_args
        assert "checkout" in flat_args
        assert "tag" in flat_args
        assert "push" in flat_args

def test_sso_login_bypass():
    from app.services.auth_service import get_current_user
    # Test that the dependency accepts Bearer sso_mock_token and returns sso_user
    username = get_current_user(authorization="Bearer sso_mock_token")
    assert username == "sso_user"


