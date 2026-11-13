import pytest
from pydantic import ValidationError

from app.domain.schemas.campaign_source_link import CampaignSourceLinkUpsert


def test_link_de_campanha_rejeita_url_nao_https() -> None:
    with pytest.raises(ValidationError):
        CampaignSourceLinkUpsert(
            title="Reel: agentes de IA",
            source_url="http://www.instagram.com/reel/ABC123/",
            thumbnail_url="",
        )


def test_link_de_campanha_rejeita_titulo_e_url_em_branco() -> None:
    with pytest.raises(ValidationError):
        CampaignSourceLinkUpsert(title="   ", source_url="   ")
