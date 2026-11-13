import json

import httpx
import pytest

from app.infrastructure.indexnow import IndexNowClient


def recording_transport(
    requests: list[httpx.Request], status_code: int = 200
) -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(status_code)

    return httpx.MockTransport(handler)


@pytest.mark.asyncio
async def test_submit_paths_posts_absolute_urls_with_key_location() -> None:
    requests: list[httpx.Request] = []
    client = IndexNowClient(
        "abc123", "https://talimpo.test/", transport=recording_transport(requests)
    )

    await client.submit_paths(["/", "/guias", "/guias/x", "/guias/x"])

    assert json.loads(requests[0].content) == {
        "host": "talimpo.test",
        "key": "abc123",
        "keyLocation": "https://talimpo.test/abc123.txt",
        "urlList": [
            "https://talimpo.test/",
            "https://talimpo.test/guias",
            "https://talimpo.test/guias/x",
        ],
    }


@pytest.mark.asyncio
async def test_submit_paths_without_key_sends_nothing() -> None:
    requests: list[httpx.Request] = []

    await IndexNowClient(
        "", "https://talimpo.test", transport=recording_transport(requests)
    ).submit_paths(["/"])

    assert requests == []


@pytest.mark.asyncio
async def test_submit_paths_never_raises_on_rejection_or_network_error() -> None:
    def offline(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("offline", request=request)

    await IndexNowClient(
        "k", "https://talimpo.test", transport=recording_transport([], 422)
    ).submit_paths(["/"])
    await IndexNowClient(
        "k", "https://talimpo.test", transport=httpx.MockTransport(offline)
    ).submit_paths(["/"])
