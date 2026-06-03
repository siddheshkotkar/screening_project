import os
import threading
from typing import List, Optional
from app.models.schemas import FeedSchema

# Lock for thread safety during file I/O operations
_file_lock = threading.Lock()

DEFAULT_HEADER = "ID|Keywords|BU|Public|Private"

def parse_line(line: str) -> Optional[FeedSchema]:
    """
    Parses a single line from the text file into a FeedSchema model.
    """
    line = line.strip("\r\n")
    if not line or line.startswith("ID|Keywords"):
        return None
    
    parts = line.split("|")
    # Pad parts to ensure we have exactly 5 columns
    while len(parts) < 5:
        parts.append("")
    
    feed_id = parts[0].strip()
    keywords_str = parts[1].strip()
    bu = parts[2].strip()
    public = parts[3].strip()
    private = parts[4].strip()
    
    # Split keywords by ~ and filter empty ones
    keywords = [k.strip() for k in keywords_str.split("~") if k.strip()]
    
    return FeedSchema(
        id=feed_id,
        keywords=keywords,
        bu=bu,
        public=public,
        private=private
    )

def serialize_feed(feed: FeedSchema) -> str:
    """
    Serializes a FeedSchema back into the pipe-delimited format.
    """
    keywords_str = "~".join(feed.keywords)
    return f"{feed.id}|{keywords_str}|{feed.bu}|{feed.public}|{feed.private}"

class FileService:
    @staticmethod
    def load_feeds(file_path: str) -> List[FeedSchema]:
        """
        Reads the local file and parses it into a list of FeedSchema objects.
        """
        if not os.path.exists(file_path):
            # Create directories and file if not exists
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(DEFAULT_HEADER + "\n")
            return []

        feeds = []
        with _file_lock:
            with open(file_path, "r", encoding="utf-8") as f:
                for line in f:
                    feed = parse_line(line)
                    if feed:
                        feeds.append(feed)
        return feeds

    @staticmethod
    def save_feeds(file_path: str, feeds: List[FeedSchema]) -> None:
        """
        Saves all feeds back to the local file, preserving the structure and headers.
        """
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with _file_lock:
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(DEFAULT_HEADER + "\n")
                for feed in feeds:
                    f.write(serialize_feed(feed) + "\n")

    @classmethod
    def get_feed_by_name(cls, file_path: str, feed_name: str) -> Optional[FeedSchema]:
        feeds = cls.load_feeds(file_path)
        for feed in feeds:
            if feed.id.lower() == feed_name.strip().lower():
                return feed
        return None

    @classmethod
    def keyword_exists_in_feed(cls, file_path: str, feed_name: str, keyword: str) -> bool:
        feed = cls.get_feed_by_name(file_path, feed_name)
        if not feed:
            return False
        
        target = keyword.strip().lower()
        return any(k.lower() == target for k in feed.keywords)

    @classmethod
    def keyword_exists_anywhere(cls, file_path: str, keyword: str) -> bool:
        feeds = cls.load_feeds(file_path)
        target = keyword.strip().lower()
        for feed in feeds:
            if any(k.lower() == target for k in feed.keywords):
                return True
        return False

    @classmethod
    def add_keyword(cls, file_path: str, keyword: str, feed_name: str, add_to_clp: bool = False, add_to_core: bool = False) -> FeedSchema:
        """
        Adds a keyword to a specific feed, and optionally to CLP and CORE_LIST.
        """
        keyword = keyword.strip()
        feeds = cls.load_feeds(file_path)
        
        # Check if target feed exists
        target_feed = None
        for feed in feeds:
            if feed.id.lower() == feed_name.strip().lower():
                target_feed = feed
                break
        
        if not target_feed:
            raise ValueError(f"Feed '{feed_name}' not found.")
            
        # Check duplicate in target feed
        if any(k.lower() == keyword.lower() for k in target_feed.keywords):
            raise ValueError(f"Keyword '{keyword}' already exists in feed '{feed_name}'.")

        # Add to target feed
        target_feed.keywords.append(keyword)

        # CLP list check and update
        if add_to_clp:
            clp_feed = None
            for feed in feeds:
                if feed.id == "CLP":
                    clp_feed = feed
                    break
            if clp_feed:
                if not any(k.lower() == keyword.lower() for k in clp_feed.keywords):
                    clp_feed.keywords.append(keyword)
            else:
                # If CLP row does not exist, create it
                feeds.append(FeedSchema(id="CLP", keywords=[keyword], bu="CLP"))

        # CORE_LIST list check and update
        if add_to_core:
            core_feed = None
            for feed in feeds:
                if feed.id == "CORE_LIST":
                    core_feed = feed
                    break
            if core_feed:
                if not any(k.lower() == keyword.lower() for k in core_feed.keywords):
                    core_feed.keywords.append(keyword)
            else:
                # If CORE_LIST row does not exist, create it
                feeds.append(FeedSchema(id="CORE_LIST", keywords=[keyword], bu="Core Policy Keywords"))

        # Save updates
        cls.save_feeds(file_path, feeds)
        return target_feed

    @classmethod
    def remove_keyword_from_feed(cls, file_path: str, keyword: str, feed_name: str) -> None:
        """
        Removes a keyword from a specific feed.
        """
        keyword = keyword.strip()
        feeds = cls.load_feeds(file_path)
        
        target_feed = None
        for feed in feeds:
            if feed.id.lower() == feed_name.strip().lower():
                target_feed = feed
                break
                
        if not target_feed:
            raise ValueError(f"Feed '{feed_name}' not found.")

        # Find the keyword (case-insensitive)
        matched_k = None
        for k in target_feed.keywords:
            if k.lower() == keyword.lower():
                matched_k = k
                break
                
        if not matched_k:
            raise ValueError(f"Keyword '{keyword}' not found in feed '{feed_name}'.")
            
        target_feed.keywords.remove(matched_k)
        cls.save_feeds(file_path, feeds)

    @classmethod
    def remove_keyword_globally(cls, file_path: str, keyword: str) -> None:
        """
        Removes a keyword globally from all feeds, CLP, CORE_LIST, and other lists.
        """
        keyword = keyword.strip().lower()
        feeds = cls.load_feeds(file_path)
        
        modified = False
        for feed in feeds:
            new_keywords = [k for k in feed.keywords if k.lower() != keyword]
            if len(new_keywords) != len(feed.keywords):
                feed.keywords = new_keywords
                modified = True
                
        if not modified:
            raise ValueError(f"Keyword '{keyword}' not found anywhere in the file.")
            
        cls.save_feeds(file_path, feeds)
