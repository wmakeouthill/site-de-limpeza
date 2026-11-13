"""Otimizacao de imagens enviadas (uploads do CMS) para WebP.

Converte rasters (PNG/JPEG/GIF estatico) para WebP, corrige orientacao EXIF e
redimensiona para um teto de lado maior. Vetores (SVG) e GIFs animados sao
deixados intactos: SVG ja e leve/escala sem perda e GIF animado perderia a
animacao na conversao simples.

O bundle musllinux/manylinux do Pillow ja embute libwebp/libjpeg/zlib, entao
nao e preciso instalar libs de sistema na imagem Alpine.
"""

from __future__ import annotations

import io
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Teto do lado maior. Cobre o maior uso real (cover/screenshot de case ~ retina,
# exibidos ate ~850px) sem manter uploads gigantes. WebP cuida do grosso da
# economia; o teto evita servir 1138px para um logo de 40px, p.ex.
DEFAULT_MAX_SIDE = 1080
DEFAULT_QUALITY = 80

# Tipos rasterizados que vale a pena converter. SVG fica de fora de proposito.
_RASTER_CONTENT_TYPES = {
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif",
}


_MIME_BY_EXTENSION = {
    ".webp": "image/webp",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
}


def guess_image_mime(file_name: str, *, default: str = "image/png") -> str:
    """Deriva o mime de uma imagem pela extensao do nome do arquivo."""

    lowered = file_name.lower()
    for extension, mime in _MIME_BY_EXTENSION.items():
        if lowered.endswith(extension):
            return mime
    return default


@dataclass(frozen=True)
class OptimizedImage:
    data: bytes
    extension: str  # ex.: ".webp"
    mime_type: str  # ex.: "image/webp"
    width: int
    height: int


def optimize_to_webp(
    data: bytes,
    content_type: str,
    *,
    max_side: int = DEFAULT_MAX_SIDE,
    quality: int = DEFAULT_QUALITY,
) -> OptimizedImage | None:
    """Converte bytes de imagem raster para WebP otimizado.

    Retorna ``None`` quando a imagem deve ser mantida como esta (SVG, GIF
    animado, formato nao raster) ou quando a conversao falha — nesses casos o
    chamador segue com os bytes originais, sem quebrar o upload.
    """

    normalized_type = (content_type or "").lower()
    if normalized_type not in _RASTER_CONTENT_TYPES:
        return None

    try:
        from PIL import Image, ImageOps, ImageSequence
    except ImportError:  # Pillow ausente: nunca derruba o upload.
        logger.warning("Pillow indisponivel; upload mantido sem otimizacao.")
        return None

    try:
        with Image.open(io.BytesIO(data)) as image:
            # GIF animado: preservar (conversao simples perderia a animacao).
            if getattr(image, "is_animated", False):
                return None
            if normalized_type == "image/gif":
                frames = sum(1 for _ in ImageSequence.Iterator(image))
                if frames > 1:
                    return None

            # Corrige rotacao gravada em EXIF antes de descartar o metadado.
            image = ImageOps.exif_transpose(image)

            has_alpha = image.mode in ("RGBA", "LA", "PA") or (
                image.mode == "P" and "transparency" in image.info
            )
            image = image.convert("RGBA" if has_alpha else "RGB")

            largest = max(image.width, image.height)
            if largest > max_side:
                ratio = max_side / largest
                new_size = (
                    max(1, round(image.width * ratio)),
                    max(1, round(image.height * ratio)),
                )
                image = image.resize(new_size, Image.LANCZOS)

            buffer = io.BytesIO()
            image.save(buffer, format="WEBP", quality=quality, method=6)
            return OptimizedImage(
                data=buffer.getvalue(),
                extension=".webp",
                mime_type="image/webp",
                width=image.width,
                height=image.height,
            )
    except Exception:  # noqa: BLE001 - imagem corrompida/exotica: mantem original.
        logger.exception("Falha ao otimizar imagem; upload mantido sem otimizacao.")
        return None


def optimize_avatar_bytes(
    data: bytes,
    content_type: str,
    *,
    max_side: int = 512,
) -> tuple[bytes, str]:
    """Otimiza foto de perfil (avatar) para WebP se aplicavel."""
    optimized = optimize_to_webp(data, content_type, max_side=max_side, quality=85)
    if optimized is not None:
        return optimized.data, optimized.mime_type
    return data, content_type


def optimize_upload_bytes(
    data: bytes,
    content_type: str,
    extension: str,
    *,
    max_side: int = DEFAULT_MAX_SIDE,
    quality: int = DEFAULT_QUALITY,
) -> tuple[bytes, str, str]:
    """Otimiza imagem de upload para WebP se aplicavel, preservando tipo original se nao otimizavel."""
    optimized = optimize_to_webp(data, content_type, max_side=max_side, quality=quality)
    if optimized is not None:
        return optimized.data, optimized.mime_type, optimized.extension
    return data, content_type, extension

