# ruff: noqa: E402

import os

from fastapi.testclient import TestClient

from app.domain.schemas.testimonial import (
    TestimonialReorderRequest,
    TestimonialResponse,
    TestimonialUpsert,
)
from app.infrastructure.config.settings import get_settings
from app.infrastructure.security.cms_session import CmsUser
from app.interfaces.api.v1.dependencies.auth import require_cms_user
from app.interfaces.api.v1.dependencies.services import get_testimonial_service

# A rota nao usa cache de pagina. Evita que a configuracao local de producao
# aponte o DiskCache de teste para um caminho inexistente no Windows.
os.environ["PUBLIC_CACHE_L2_ENABLED"] = "false"
get_settings.cache_clear()
from app.main import create_app


class FakeTestimonialService:
    def __init__(self) -> None:
        self.items: list[TestimonialResponse] = []
        self.reordered: list[str] = []

    async def list_by_site(self, site: str) -> list[TestimonialResponse]:
        return [item for item in self.items if item.site == site]

    async def create(self, payload: TestimonialUpsert, author_email: str) -> TestimonialResponse:
        created = TestimonialResponse(
            id=f"id-{len(self.items)}",
            sort_order=len(self.items),
            **payload.model_dump(),
        )
        self.items.append(created)
        return created

    async def update(
        self, testimonial_id: str, payload: TestimonialUpsert, author_email: str
    ) -> TestimonialResponse | None:
        for index, item in enumerate(self.items):
            if item.id == testimonial_id:
                self.items[index] = TestimonialResponse(
                    id=testimonial_id, sort_order=item.sort_order, **payload.model_dump()
                )
                return self.items[index]
        return None

    async def delete(self, testimonial_id: str) -> bool:
        before = len(self.items)
        self.items = [item for item in self.items if item.id != testimonial_id]
        return len(self.items) != before

    async def reorder(self, payload: TestimonialReorderRequest) -> bool:
        if any(item_id == "de-outro-site" for item_id in payload.ids):
            return False
        self.reordered = payload.ids
        return True


def _client(service: FakeTestimonialService) -> TestClient:
    app = create_app()
    app.dependency_overrides[require_cms_user] = lambda: CmsUser(
        email="editor@example.com", name="Editor", object_id="user-id"
    )
    app.dependency_overrides[get_testimonial_service] = lambda: service
    return TestClient(app)


def _payload(**overrides) -> dict:
    data = {"site": "falcao", "author": "Eduardo Loyola", "quote": "Time excelente."}
    data.update(overrides)
    return data


def test_cms_cria_lista_edita_e_remove_depoimento() -> None:
    client = _client(FakeTestimonialService())

    created = client.post("/api/cms/testimonials", json=_payload())
    assert created.status_code == 201
    testimonial_id = created.json()["id"]

    listed = client.get("/api/cms/testimonials", params={"site": "falcao"})
    assert [item["author"] for item in listed.json()] == ["Eduardo Loyola"]

    edited = client.put(
        f"/api/cms/testimonials/{testimonial_id}", json=_payload(author="Outro Autor")
    )
    assert edited.json()["author"] == "Outro Autor"

    assert client.delete(f"/api/cms/testimonials/{testimonial_id}").status_code == 204
    assert client.delete(f"/api/cms/testimonials/{testimonial_id}").status_code == 404


def test_cms_reordena_depoimentos() -> None:
    service = FakeTestimonialService()
    response = _client(service).put(
        "/api/cms/testimonials/reorder", json={"site": "falcao", "ids": ["b", "a"]}
    )

    assert response.status_code == 204
    assert service.reordered == ["b", "a"]


def test_cms_rejeita_reorder_com_id_de_outro_site() -> None:
    response = _client(FakeTestimonialService()).put(
        "/api/cms/testimonials/reorder",
        json={"site": "falcao", "ids": ["de-outro-site"]},
    )

    assert response.status_code == 422


def test_cms_rejeita_depoimento_de_outro_site() -> None:
    response = _client(FakeTestimonialService()).post(
        "/api/cms/testimonials", json=_payload(site="outro")
    )

    assert response.status_code == 422


def test_rotas_de_depoimento_exigem_sessao_do_cms() -> None:
    app = create_app()
    app.dependency_overrides[get_testimonial_service] = lambda: FakeTestimonialService()

    response = TestClient(app).get("/api/cms/testimonials", params={"site": "falcao"})

    assert response.status_code == 401
