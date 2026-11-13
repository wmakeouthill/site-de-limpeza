from __future__ import annotations

import asyncio
import hashlib
import time
from collections import OrderedDict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

try:
    from cachetools import LRUCache
except ModuleNotFoundError:  # pragma: no cover - fallback for local env before dependency install
    LRUCache = None

try:
    from diskcache import Cache as DiskCache
except ModuleNotFoundError:  # pragma: no cover - fallback for local env before dependency install
    DiskCache = None


@dataclass(slots=True)
class PublicCacheEntry:
    key: str
    value: Any
    created_at: float
    expires_at: float
    stale_until: float
    tags: set[str] = field(default_factory=set)
    etag: str = ""

    @property
    def is_fresh(self) -> bool:
        return time.time() < self.expires_at

    @property
    def is_stale_available(self) -> bool:
        return time.time() < self.stale_until


@dataclass(slots=True)
class PublicCacheResult:
    status: str
    entry: PublicCacheEntry | None

    @property
    def value(self) -> Any:
        return self.entry.value if self.entry else None

    @property
    def etag(self) -> str:
        return self.entry.etag if self.entry else ""


class _FallbackLruCache:
    def __init__(self, maxsize: int):
        self.maxsize = maxsize
        self._items: OrderedDict[str, PublicCacheEntry] = OrderedDict()

    def get(self, key: str) -> PublicCacheEntry | None:
        entry = self._items.get(key)
        if entry is not None:
            self._items.move_to_end(key)
        return entry

    def __setitem__(self, key: str, value: PublicCacheEntry) -> None:
        self._items[key] = value
        self._items.move_to_end(key)
        while len(self._items) > self.maxsize:
            self._items.popitem(last=False)

    def pop(self, key: str, default: Any = None) -> Any:
        return self._items.pop(key, default)

    def clear(self) -> None:
        self._items.clear()


class PublicCacheStore:
    def __init__(
        self,
        max_entries: int,
        persistent_dir: Path | None = None,
        persistent_enabled: bool = False,
    ):
        self._memory_cache = self._create_memory_cache(max_entries)
        self._persistent_cache = self._create_persistent_cache(persistent_dir, persistent_enabled)
        self._tag_index: dict[str, set[str]] = {}
        self._locks: dict[str, asyncio.Lock] = {}
        self._refreshing_keys: set[str] = set()
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> PublicCacheResult:
        entry = self._get_from_memory(key)
        if not entry:
            entry = self._get_from_persistent(key)
            if entry:
                self._set_memory(entry)

        if not entry:
            return PublicCacheResult(status="MISS", entry=None)
        if entry.is_fresh:
            return PublicCacheResult(status="HIT", entry=entry)
        if entry.is_stale_available:
            return PublicCacheResult(status="STALE", entry=entry)

        await self.delete(key)
        return PublicCacheResult(status="MISS", entry=None)

    async def set(
        self,
        key: str,
        value: Any,
        ttl_seconds: int,
        stale_seconds: int,
        tags: set[str] | None = None,
        etag: str | None = None,
    ) -> PublicCacheEntry:
        now = time.time()
        entry = PublicCacheEntry(
            key=key,
            value=value,
            created_at=now,
            expires_at=now + ttl_seconds,
            stale_until=now + ttl_seconds + stale_seconds,
            tags=tags or set(),
            etag=etag or create_etag(value),
        )
        self._set_memory(entry)
        self._set_persistent(entry)
        self._index_tags(entry)
        return entry

    async def delete(self, key: str) -> None:
        self._memory_cache.pop(key, None)
        if self._persistent_cache is not None:
            self._persistent_cache.delete(key)
        for keys in self._tag_index.values():
            keys.discard(key)

    async def invalidate_tags(self, tags: set[str]) -> None:
        keys: set[str] = set()
        for tag in tags:
            keys.update(self._tag_index.get(tag, set()))
        keys.update(self._find_persistent_keys_by_tags(tags))
        for key in keys:
            await self.delete(key)

    async def clear(self) -> None:
        self._memory_cache.clear()
        if self._persistent_cache is not None:
            self._persistent_cache.clear()
        self._tag_index.clear()

    async def get_lock(self, key: str) -> asyncio.Lock:
        async with self._lock:
            if key not in self._locks:
                self._locks[key] = asyncio.Lock()
            return self._locks[key]

    async def claim_refresh(self, key: str) -> bool:
        async with self._lock:
            if key in self._refreshing_keys:
                return False
            self._refreshing_keys.add(key)
            return True

    async def release_refresh(self, key: str) -> None:
        async with self._lock:
            self._refreshing_keys.discard(key)

    @staticmethod
    def _create_memory_cache(max_entries: int):
        if LRUCache is None:
            return _FallbackLruCache(max_entries)
        return LRUCache(maxsize=max_entries)

    @staticmethod
    def _create_persistent_cache(persistent_dir: Path | None, enabled: bool):
        if not enabled or persistent_dir is None or DiskCache is None:
            return None
        persistent_dir.mkdir(parents=True, exist_ok=True)
        return DiskCache(str(persistent_dir))

    def _get_from_memory(self, key: str) -> PublicCacheEntry | None:
        return self._memory_cache.get(key)

    def _set_memory(self, entry: PublicCacheEntry) -> None:
        self._memory_cache[entry.key] = entry
        self._index_tags(entry)

    def _get_from_persistent(self, key: str) -> PublicCacheEntry | None:
        if self._persistent_cache is None:
            return None
        entry = self._persistent_cache.get(key)
        return entry if isinstance(entry, PublicCacheEntry) else None

    def _set_persistent(self, entry: PublicCacheEntry) -> None:
        if self._persistent_cache is not None:
            expires_in = max(1, int(entry.stale_until - time.time()))
            self._persistent_cache.set(entry.key, entry, expire=expires_in)

    def _index_tags(self, entry: PublicCacheEntry) -> None:
        for tag in entry.tags:
            self._tag_index.setdefault(tag, set()).add(entry.key)

    def _find_persistent_keys_by_tags(self, tags: set[str]) -> set[str]:
        if self._persistent_cache is None:
            return set()

        matching_keys: set[str] = set()
        for key in self._persistent_cache.iterkeys():
            entry = self._persistent_cache.get(key)
            if isinstance(entry, PublicCacheEntry) and entry.tags.intersection(tags):
                matching_keys.add(entry.key)
        return matching_keys


def create_etag(value: Any) -> str:
    if isinstance(value, bytes):
        payload = value
    else:
        payload = str(value).encode("utf-8")
    return f'"{hashlib.sha256(payload).hexdigest()[:24]}"'
