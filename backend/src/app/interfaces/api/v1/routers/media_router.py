import mimetypes
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse

from app.infrastructure.config.settings import Settings, get_settings

router = APIRouter(tags=["media"])

_IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable"


@router.get("/media/{blob_key:path}")
async def serve_media(
    blob_key: str,
    settings: Annotated[Settings, Depends(get_settings)],
) -> FileResponse:
    upload_root = settings.cms_upload_path.resolve()
    normalized = blob_key.strip().lstrip("/")
    if not normalized or ".." in Path(normalized).parts:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Midia nao encontrada.",
        )

    candidate = (upload_root / normalized).resolve()
    try:
        candidate.relative_to(upload_root)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Midia nao encontrada.",
        ) from error

    if not candidate.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Midia nao encontrada.",
        )

    media_type, _ = mimetypes.guess_type(candidate.name)
    return FileResponse(
        path=candidate,
        media_type=media_type or "application/octet-stream",
        headers={
            "Cache-Control": _IMMUTABLE_CACHE_CONTROL,
            "X-Content-Type-Options": "nosniff",
        },
    )

