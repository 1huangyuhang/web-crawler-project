from dataclasses import dataclass


@dataclass
class CrawlConfig:
    max_concurrent: int = 5
    request_delay: float = 0.5
    timeout: int = 15
    max_retries: int = 3
    user_agent: str = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
