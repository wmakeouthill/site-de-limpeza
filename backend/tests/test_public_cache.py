import pytest

from app.infrastructure.cache import public_cache
from app.infrastructure.cache.public_cache import PublicCacheStore


@pytest.mark.asyncio
async def test_cache_returns_hit_then_stale_then_miss() -> None:
    cache = PublicCacheStore(max_entries=10)
    await cache.set(
        key="data:falcao:articles:list",
        value=[{"slug": "defesa-penal"}],
        ttl_seconds=0,
        stale_seconds=1,
        tags={"articles"},
    )

    stale_result = await cache.get("data:falcao:articles:list")

    assert stale_result.status == "STALE"
    assert stale_result.value == [{"slug": "defesa-penal"}]


@pytest.mark.asyncio
async def test_cache_invalidates_by_tag() -> None:
    cache = PublicCacheStore(max_entries=10)
    await cache.set(
        key="data:falcao:article:defesa-penal",
        value={"slug": "defesa-penal"},
        ttl_seconds=60,
        stale_seconds=60,
        tags={"articles", "article:defesa-penal"},
    )

    await cache.invalidate_tags({"article:defesa-penal"})
    result = await cache.get("data:falcao:article:defesa-penal")

    assert result.status == "MISS"


@pytest.mark.asyncio
async def test_cache_claim_refresh_deduplicates_key() -> None:
    cache = PublicCacheStore(max_entries=10)

    first_claim = await cache.claim_refresh("data:falcao:home")
    second_claim = await cache.claim_refresh("data:falcao:home")
    await cache.release_refresh("data:falcao:home")
    third_claim = await cache.claim_refresh("data:falcao:home")

    assert first_claim is True
    assert second_claim is False
    assert third_claim is True


@pytest.mark.asyncio
@pytest.mark.skipif(public_cache.DiskCache is None, reason="diskcache nao instalado")
async def test_cache_reads_persistent_entry_after_restart(tmp_path) -> None:
    first_cache = PublicCacheStore(
        max_entries=10,
        persistent_dir=tmp_path,
        persistent_enabled=True,
    )
    await first_cache.set(
        key="data:falcao:home",
        value={"title": "Falcão Limpeza"},
        ttl_seconds=60,
        stale_seconds=60,
        tags={"home"},
    )

    restarted_cache = PublicCacheStore(
        max_entries=10,
        persistent_dir=tmp_path,
        persistent_enabled=True,
    )
    result = await restarted_cache.get("data:falcao:home")

    assert result.status == "HIT"
    assert result.value == {"title": "Falcão Limpeza"}
