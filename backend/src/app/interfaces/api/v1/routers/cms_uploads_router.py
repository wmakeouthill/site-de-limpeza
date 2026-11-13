import io
import re
from pathlib import Path
from typing import Annotated
from uuid import uuid4

from azure.storage.blob import BlobServiceClient, ContentSettings
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from app.infrastructure.config.settings import Settings, get_settings
from app.infrastructure.images import optimize_upload_bytes
from app.infrastructure.security.cms_session import CmsUser
from app.interfaces.api.v1.dependencies.auth import require_cms_user

router = APIRouter(prefix="/api/cms", tags=["CMS Uploads"])

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MiB


def _safe_stem(filename: str) -> str:
    cleaned_name = filename.replace("\\", "/").split("/")[-1]
    stem = Path(cleaned_name or "image").stem.lower()
    cleaned = re.sub(r"[^a-z0-9_-]+", "-", stem).strip("-")
    return cleaned[:60] or "image"


@router.post("/uploads", status_code=status.HTTP_201_CREATED)
async def upload_cms_image(
    file: Annotated[UploadFile, File(...)],
    settings: Annotated[Settings, Depends(get_settings)],
    _user: Annotated[CmsUser, Depends(require_cms_user)],
) -> dict[str, str | int]:
    raw_name = (file.filename or "").lower()
    content_type = (file.content_type or "").lower().split(";")[0].strip()

    # Reject path traversal attempts in filename
    if ".." in raw_name or "/" in raw_name or "\\" in raw_name:
        raw_name = raw_name.replace("\\", "/").split("/")[-1]

    # Explicitly reject SVG via MIME, extension, or payload content (415)
    if (
        content_type == "image/svg+xml"
        or raw_name.endswith(".svg")
        or raw_name.endswith(".svgz")
    ):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Formato SVG nao e permitido por razoes de seguranca.",
        )

    extension = ALLOWED_IMAGE_TYPES.get(content_type)
    if not extension:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Formato de imagem nao suportado. Use PNG, JPG, WEBP ou GIF.",
        )

    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Arquivo de imagem vazio.",
        )
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Arquivo excede o limite maximo de 5 MB.",
        )

    # Detect SVG byte signatures (415)
    header_sample = content[:2048].lower()
    if b"<svg" in header_sample or (b"<?xml" in header_sample and b"<svg" in content.lower()):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Formato SVG nao e permitido por razoes de seguranca.",
        )

    # Pillow byte validation and decode check
    try:
        from PIL import Image

        with Image.open(io.BytesIO(content)) as img:
            img.verify()
        with Image.open(io.BytesIO(content)) as img:
            if img.format not in ("PNG", "JPEG", "WEBP", "GIF"):
                raise HTTPException(
                    status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                    detail="Formato de imagem incompativel.",
                )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Arquivo de imagem corrompido ou invalido.",
        ) from exc

    content, content_type, extension = optimize_upload_bytes(content, content_type, extension)
    safe_stem_str = _safe_stem(file.filename or "image")
    stored_name = f"{uuid4().hex}-{safe_stem_str}{extension}"

    if settings.azure_storage_connection_string:
        url = _upload_to_azure_blob(content, stored_name, content_type, settings)
    else:
        upload_dir = settings.cms_upload_path
        upload_dir.mkdir(parents=True, exist_ok=True)
        (upload_dir / stored_name).write_bytes(content)
        url = f"/media/{stored_name}"

    return {
        "url": url,
        "fileName": file.filename or stored_name,
        "mimeType": content_type,
        "sizeBytes": len(content),
    }


def _upload_to_azure_blob(
    content: bytes,
    stored_name: str,
    content_type: str,
    settings: Settings,
) -> str:
    service_client = BlobServiceClient.from_connection_string(
        settings.azure_storage_connection_string
    )
    container_client = service_client.get_container_client(settings.azure_storage_container)
    blob_client = container_client.get_blob_client(stored_name)
    blob_client.upload_blob(
        content,
        overwrite=True,
        content_settings=ContentSettings(content_type=content_type),
    )
    return str(blob_client.url)
