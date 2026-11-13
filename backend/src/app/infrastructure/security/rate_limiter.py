import time
from threading import Lock


class InMemoryRateLimiter:
    """Rate limit por chave (ex.: IP) com janela fixa, em memoria do processo.

    ponytail: contador por processo — em multiplos workers/instancias cada um
    tem o seu, entao o teto efetivo e `max_hits * n_processos`. Suficiente para
    barrar spam de formulario; se um dia precisar de limite global exato, trocar
    a implementacao por Redis mantendo a mesma interface `allow(key)`.
    """

    # Acima disso, faz uma limpeza dos buckets expirados antes de inserir novos,
    # para o dict nao crescer sem limite sob um flood de IPs distintos.
    _PRUNE_THRESHOLD = 10_000

    def __init__(
        self,
        max_hits: int = 60,
        window_seconds: int = 60,
        *,
        max_requests: int | None = None,
    ) -> None:
        self._max = max_requests if max_requests is not None else max_hits
        self._window = window_seconds
        self._buckets: dict[str, tuple[float, int]] = {}
        self._lock = Lock()

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        with self._lock:
            if len(self._buckets) > self._PRUNE_THRESHOLD:
                self._prune(now)
            start, count = self._buckets.get(key, (now, 0))
            if now - start >= self._window:
                start, count = now, 0
            count += 1
            self._buckets[key] = (start, count)
            return count <= self._max

    def _prune(self, now: float) -> None:
        expired = [k for k, (start, _) in self._buckets.items() if now - start >= self._window]
        for key in expired:
            del self._buckets[key]


SlidingWindowRateLimiter = InMemoryRateLimiter


if __name__ == "__main__":
    limiter = InMemoryRateLimiter(max_hits=3, window_seconds=1)
    assert [limiter.allow("ip") for _ in range(5)] == [True, True, True, False, False]
    assert limiter.allow("outro-ip") is True  # chave diferente tem bucket proprio
    time.sleep(1.01)
    assert limiter.allow("ip") is True  # janela expirou, contador reseta
    print("ok")
