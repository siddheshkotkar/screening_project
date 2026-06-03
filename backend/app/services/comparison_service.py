import httpx
import logging
from typing import List, Tuple, Dict
from app.models.schemas import CompareResponse, CompareSummary, FeedDiff, FeedSchema
from app.services.file_service import FileService, parse_line

logger = logging.getLogger(__name__)

# Sample mock GitLab file content to fallback on for demonstration/testing
MOCK_GITLAB_CONTENT = """ID|Keywords|BU|Public|Private
CLP|OFAC~OFAC-NONSDN~BXA~BXAENT~BXAUNVER~DTI-SEC~EU~EUFSR-RUS~EUFSR-SYR~FIRSE-WC~UKHMT-AN~UKHMT-IB~UN~USDTC~USTREAS.311~BISN~CAATSA228-WC~ITRSHRA~SDTEL~UKHO|CLP||
CORE_LIST|OFAC~OFAC-NONSDN~BXA~BXAENT~BXAUNVER~DTI-SEC~EU~EUFSR-RUS~EUFSR-SYR~FIRSE-WC|Core Policy Keywords||
Barclaycard_BPAID|OFAC~OFAC-NONSDN~EU~EUFSR-RUS~EUFSR-SYR~FIRSE-WC~UKHMT-AN~UKHMT-IB~UN|Barclaycard core||
Old_Deprecated_Feed|SOME_OLD_KEYWORD~TEST_KEYWORD|Deprecated BU||
"""

class ComparisonService:
    @staticmethod
    def parse_content(content: str) -> List[FeedSchema]:
        """
        Parses raw text content (pipe-delimited) into a list of FeedSchema objects.
        """
        feeds = []
        for line in content.splitlines():
            feed = parse_line(line)
            if feed:
                feeds.append(feed)
        return feeds

    @classmethod
    def fetch_remote_file(cls, url: str, token: str = "") -> List[FeedSchema]:
        """
        Fetches the GitLab file. If it fails, raises an exception.
        Supports fallback mock content if url contains 'example.com' to allow testing/dev.
        Also supports file:// schema for unit testing.
        """
        if url.startswith("file://"):
            try:
                local_path = url.replace("file://", "")
                with open(local_path, "r", encoding="utf-8") as f:
                    return cls.parse_content(f.read())
            except Exception as e:
                logger.error(f"Failed to read file from {url}: {e}")
                raise RuntimeError(f"Could not retrieve local file: {str(e)}")

        if "example.com" in url:
            # Dev fallback for testing
            logger.info("Using mock GitLab content for testing/dev.")
            return cls.parse_content(MOCK_GITLAB_CONTENT)
            
        try:
            # Fetch with a 5 second timeout, ignoring SSL verification for self-signed certificates
            headers = {}
            if token.strip():
                headers["PRIVATE-TOKEN"] = token.strip()
            response = httpx.get(url, headers=headers, timeout=5.0, verify=False)
            response.raise_for_status()
            return cls.parse_content(response.text)
        except Exception as e:
            logger.error(f"Failed to fetch GitLab file from {url}: {e}")
            raise RuntimeError(f"Could not retrieve GitLab file: {str(e)}")

    @classmethod
    def compare_files(cls, local_path: str, gitlab_url: str, token: str = "") -> CompareResponse:
        """
        Performs a full diff between the local file and GitLab file.
        """
        local_feeds = FileService.load_feeds(local_path)
        
        try:
            gitlab_feeds = cls.fetch_remote_file(gitlab_url, token)
        except Exception as e:
            # Re-raise to be caught by route handler
            raise e

        # Convert to dictionaries for easy lookup
        local_map: Dict[str, FeedSchema] = {f.id: f for f in local_feeds}
        gitlab_map: Dict[str, FeedSchema] = {f.id: f for f in gitlab_feeds}

        all_ids = set(local_map.keys()).union(set(gitlab_map.keys()))

        details: List[FeedDiff] = []
        special_lists: List[FeedDiff] = []

        feeds_added = 0
        feeds_removed = 0
        feeds_modified = 0
        feeds_unchanged = 0

        # Special lists to separate
        SPECIAL_IDS = {"CLP", "CORE_LIST"}

        for feed_id in sorted(all_ids):
            local_feed = local_map.get(feed_id)
            gitlab_feed = gitlab_map.get(feed_id)

            local_keys = local_feed.keywords if local_feed else []
            gitlab_keys = gitlab_feed.keywords if gitlab_feed else []

            local_keys_set = set(k.lower() for k in local_keys)
            gitlab_keys_set = set(k.lower() for k in gitlab_keys)

            # Determine key additions/removals preserving original casing where possible
            # Added keywords: in local, not in gitlab
            added_keywords = [k for k in local_keys if k.lower() not in gitlab_keys_set]
            # Removed keywords: in gitlab, not in local
            removed_keywords = [k for k in gitlab_keys if k.lower() not in local_keys_set]

            if local_feed and not gitlab_feed:
                status = "added"
                if feed_id not in SPECIAL_IDS:
                    feeds_added += 1
            elif gitlab_feed and not local_feed:
                status = "removed"
                if feed_id not in SPECIAL_IDS:
                    feeds_removed += 1
            else:
                # Both exist, check keywords
                if local_keys_set == gitlab_keys_set:
                    status = "unchanged"
                    if feed_id not in SPECIAL_IDS:
                        feeds_unchanged += 1
                else:
                    status = "modified"
                    if feed_id not in SPECIAL_IDS:
                        feeds_modified += 1

            diff = FeedDiff(
                feed_name=feed_id,
                status=status,
                local_keywords=local_keys,
                gitlab_keywords=gitlab_keys,
                added_keywords=added_keywords,
                removed_keywords=removed_keywords
            )

            if feed_id in SPECIAL_IDS:
                special_lists.append(diff)
            else:
                details.append(diff)

        # Exclude special lists from standard feeds compared counts
        standard_ids = all_ids - SPECIAL_IDS
        summary = CompareSummary(
            total_feeds_compared=len(standard_ids),
            feeds_added=feeds_added,
            feeds_removed=feeds_removed,
            feeds_modified=feeds_modified,
            feeds_unchanged=feeds_unchanged
        )

        return CompareResponse(
            summary=summary,
            details=details,
            special_lists=special_lists
        )
