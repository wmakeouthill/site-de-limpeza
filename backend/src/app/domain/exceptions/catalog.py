class CatalogError(Exception):
    """Erro base para operações do catálogo."""


class DepartmentNotFoundError(CatalogError):
    """Departamento não encontrado."""


class ProductNotFoundError(CatalogError):
    """Produto não encontrado."""


class KitNotFoundError(CatalogError):
    """Kit não encontrado."""


class InvalidOfferError(CatalogError):
    """Dados de promoção/oferta inválidos (preço_por >= preço_de, falta promo_fim, etc.)."""


class ProductInUseConflictError(CatalogError):
    """Produto não pode ser excluído pois está em uso em um kit ou guia."""


class DuplicateSlugError(CatalogError):
    """Slug já existente no catálogo."""
