from abc import ABC, abstractmethod


class ArticleLikeRepository(ABC):
    @abstractmethod
    async def get_state(self, article_id: str, visitor_hash: str) -> tuple[bool, int]:
        pass

    @abstractmethod
    async def toggle(self, article_id: str, visitor_hash: str) -> tuple[bool, int]:
        pass
