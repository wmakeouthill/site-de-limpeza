# ruff: noqa: E402
import os
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.application.services.promocao_service import PromocaoService
from app.domain.repositories.promocao_repository import PromocaoRepository
from app.infrastructure.config.settings import get_settings
from app.infrastructure.database.base import Base
from app.infrastructure.security.cms_session import CmsUser
from app.interfaces.api.v1.dependencies.auth import require_cms_user
from app.interfaces.api.v1.dependencies.services import get_promocao_service

os.environ["PUBLIC_CACHE_L2_ENABLED"] = "false"
get_settings.cache_clear()
from app.main import create_app

TZ_SP = ZoneInfo("America/Sao_Paulo")


@pytest.fixture
async def promo_setup(tmp_path):
    db_file = tmp_path / "test_api_promocoes.db"
    url = f"sqlite+aiosqlite:///{db_file.as_posix()}"
    engine = create_async_engine(url)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    yield session_factory
    await engine.dispose()


def test_promocoes_cms_exige_autenticacao():
    app = create_app()
    client = TestClient(app)

    assert client.get("/api/cms/promocoes").status_code == 401
    assert client.post("/api/cms/promocoes", json={"titulo": "Teste"}).status_code == 401
    assert client.put("/api/cms/promocoes/123", json={"titulo": "Teste"}).status_code == 401
    assert client.delete("/api/cms/promocoes/123").status_code == 401


@pytest.mark.asyncio
async def test_crud_promocoes_e_endpoint_publico(promo_setup):
    session_factory = promo_setup

    async def override_get_service():
        async with session_factory() as session:
            repo = PromocaoRepository(session)
            yield PromocaoService(repo)

    mock_user = CmsUser(
        email="gerente@falcaolimpeza.com.br",
        name="Gerente Falcão",
        object_id="usr-1",
    )

    app = create_app()
    app.dependency_overrides[get_promocao_service] = override_get_service
    app.dependency_overrides[require_cms_user] = lambda: mock_user

    client = TestClient(app)

    now = datetime.now(TZ_SP)
    fim = now + timedelta(days=7)

    # 1. Criação com link relativo seguro (CA-17)
    res_create = client.post(
        "/api/cms/promocoes",
        json={
            "titulo": "Semana do Cloro",
            "texto": "Descontos especiais em embalagens grandes",
            "tipo_acao": "link",
            "cta_texto": "Ver produtos",
            "cta_caminho": "/produtos?oferta=1",
            "publico": "todos",
            "frequencia": "uma_vez",
            "data_inicio": now.isoformat(),
            "data_fim": fim.isoformat(),
            "prioridade": 10,
            "is_active": True,
        },
    )
    assert res_create.status_code == 201
    created_id = res_create.json()["id"]
    assert res_create.json()["titulo"] == "Semana do Cloro"
    assert res_create.json()["situacao"] == "no_ar"

    # 2. Bloqueio de URL externa no POST (CA-17) -> deve retornar 422
    res_invalida = client.post(
        "/api/cms/promocoes",
        json={
            "titulo": "Tentativa de Golpe",
            "tipo_acao": "link",
            "cta_caminho": "https://externo.com/malware",
            "data_inicio": now.isoformat(),
            "data_fim": fim.isoformat(),
        },
    )
    assert res_invalida.status_code == 422

    # 3. Consulta pública de promoções ativas
    res_public = client.get("/api/public/promocoes/ativas")
    assert res_public.status_code == 200
    ativas = res_public.json()
    assert len(ativas) >= 1
    assert ativas[0]["id"] == created_id
    assert ativas[0]["titulo"] == "Semana do Cloro"

    # 4. Listagem no CMS
    res_list = client.get("/api/cms/promocoes")
    assert res_list.status_code == 200
    assert len(res_list.json()) == 1

    # 5. Atualização no CMS
    res_put = client.put(
        f"/api/cms/promocoes/{created_id}",
        json={"prioridade": 20, "titulo": "Mega Semana do Cloro"},
    )
    assert res_put.status_code == 200
    assert res_put.json()["prioridade"] == 20
    assert res_put.json()["titulo"] == "Mega Semana do Cloro"

    # 6. Deleção no CMS
    res_del = client.delete(f"/api/cms/promocoes/{created_id}")
    assert res_del.status_code == 204

    # Confirmação de deleção
    res_after = client.get("/api/public/promocoes/ativas")
    assert len(res_after.json()) == 0
