"""Ping best-effort do IndexNow (Bing, Yandex, Seznam, Naver).

O Google não participa do IndexNow: para ele vale o sitemap.xml. A chave
(INDEXNOW_KEY) também é servida pelo Astro em /<chave>.txt; vazia = desligado.
"""

import logging
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)

INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow"


class IndexNowClient:
    def __init__(
        self,
        key: str,
        base_url: str,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._key = key.strip()
        self._base_url = base_url.rstrip("/")
        self._transport = transport

    async def submit_paths(self, paths: list[str]) -> None:
        """Avisa os buscadores; falha só vira log, porque o conteúdo já foi salvo."""
        if not self._key:
            return

        payload = {
            "host": urlparse(self._base_url).netloc,
            "key": self._key,
            "keyLocation": f"{self._base_url}/{self._key}.txt",
            "urlList": [f"{self._base_url}{path}" for path in dict.fromkeys(paths)],
        }
        try:
            async with httpx.AsyncClient(timeout=5.0, transport=self._transport) as client:
                response = await client.post(INDEXNOW_ENDPOINT, json=payload)
        except httpx.HTTPError as error:
            logger.warning("IndexNow: falha ao contatar a API: %s", error)
            return

        if response.status_code >= httpx.codes.BAD_REQUEST:
            logger.warning(
                "IndexNow recusou o ping (%s): %s", response.status_code, response.text[:200]
            )
