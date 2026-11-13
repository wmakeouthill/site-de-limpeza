import pytest
from pydantic import ValidationError

from app.domain.schemas.testimonial import TestimonialReorderRequest, TestimonialUpsert


def _payload(**overrides) -> dict:
    data = {"site": "falcao", "author": "Eduardo Loyola", "quote": "Time excelente."}
    data.update(overrides)
    return data


@pytest.mark.parametrize(
    "entrada",
    [
        "dSVKMgdf0XM",
        "https://www.youtube.com/watch?v=dSVKMgdf0XM",
        "https://www.youtube.com/watch?list=abc&v=dSVKMgdf0XM",
        "https://youtu.be/dSVKMgdf0XM",
        "https://www.youtube.com/embed/dSVKMgdf0XM",
        "https://www.youtube.com/shorts/dSVKMgdf0XM",
    ],
)
def test_extrai_o_id_do_youtube_de_id_puro_e_de_url_colada(entrada: str) -> None:
    assert TestimonialUpsert(**_payload(youtube_id=entrada)).youtube_id == "dSVKMgdf0XM"


def test_youtube_vazio_continua_vazio() -> None:
    assert TestimonialUpsert(**_payload(youtube_id="")).youtube_id == ""


def test_rejeita_youtube_que_nao_e_id_nem_url() -> None:
    with pytest.raises(ValidationError):
        TestimonialUpsert(**_payload(youtube_id="https://vimeo.com/12345"))


def test_rejeita_outro_site() -> None:
    with pytest.raises(ValidationError):
        TestimonialUpsert(**_payload(site="outro"))


@pytest.mark.parametrize("campo", ["author", "quote"])
def test_rejeita_campo_obrigatorio_so_com_espaco(campo: str) -> None:
    with pytest.raises(ValidationError):
        TestimonialUpsert(**_payload(**{campo: "   "}))


def test_reorder_rejeita_site_fora_do_escopo() -> None:
    with pytest.raises(ValidationError):
        TestimonialReorderRequest(site="outro", ids=["a"])
