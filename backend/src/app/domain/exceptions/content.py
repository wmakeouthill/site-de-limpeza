class ContentError(Exception):
    """Erro base do modulo de conteudo."""


class InvalidContentPublicationError(ContentError):
    """Conteudo nao cumpre os criterios minimos para publicacao."""


class ContentNotFoundError(ContentError):
    """Conteudo solicitado nao foi encontrado."""
