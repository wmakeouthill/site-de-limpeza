import os
from datetime import date, timedelta
from decimal import Decimal

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.domain.entities.catalog import Departamento, Produto
from app.domain.entities.enums import Forma
from app.domain.entities.site_settings import SITE_SETTINGS_SINGLETON_ID, SiteSettings
from app.infrastructure.config.settings import get_settings
from app.infrastructure.database.base import Base
from app.infrastructure.database.session import get_db_session
from app.infrastructure.security.cms_session import CmsUser
from app.interfaces.api.v1.dependencies.auth import require_cms_user

os.environ["PUBLIC_CACHE_L2_ENABLED"] = "false"
get_settings.cache_clear()
from app.main import create_app  # noqa: E402


@pytest.fixture
def cms_user():
    return CmsUser(email="editor@falcaolimpeza.com.br", name="Editor Falcão", object_id="usr-1")


@pytest.fixture
async def db_setup(tmp_path):
    db_file = tmp_path / "test_guides_articles.db"
    url = f"sqlite+aiosqlite:///{db_file.as_posix()}"
    engine = create_async_engine(url)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)
    yield session_factory
    await engine.dispose()


@pytest.fixture
def app_with_user(cms_user, db_setup):
    app = create_app()
    app.dependency_overrides[require_cms_user] = lambda: cms_user

    async def override_db():
        async with db_setup() as session:
            yield session

    app.dependency_overrides[get_db_session] = override_db
    return app


@pytest.mark.asyncio
async def test_article_categoria_and_filter(app_with_user):
    transport = ASGITransport(app=app_with_user)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Cria artigo com categoria "testamos"
        res_create = await client.post(
            "/api/cms/articles",
            json={
                "slug": "teste-detergentes-desengordurantes",
                "title": "Testamos 5 Desengordurantes",
                "excerpt": "Comparamos os principais produtos para chapas e coifas.",
                "body_markdown": "## Relatório do teste...",
                "article_detail": {
                    "categoria": "testamos",
                    "area": "Cozinha Industrial",
                    "reading_time": "5 min",
                },
            },
        )
        assert res_create.status_code == 201
        created = res_create.json()
        assert created["categoria"] == "testamos"
        art_id = created["id"]

        # 2. Publica o artigo
        res_pub = await client.post(f"/api/cms/articles/{art_id}/publish")
        assert res_pub.status_code == 200

        # 3. Lista pública sem filtro
        res_list = await client.get("/api/public/articles")
        assert res_list.status_code == 200
        items = res_list.json()
        assert any(item["slug"] == "teste-detergentes-desengordurantes" and item["categoria"] == "testamos" for item in items)

        # 4. Lista pública com filtro ?categoria=testamos
        res_filter = await client.get("/api/public/articles?categoria=testamos")
        assert res_filter.status_code == 200
        items_testamos = res_filter.json()
        assert len(items_testamos) >= 1
        assert all(item["categoria"] == "testamos" for item in items_testamos)

        # 5. Lista pública com filtro ?categoria=dicas (não deve vir o artigo de testamos)
        res_empty = await client.get("/api/public/articles?categoria=dicas")
        assert res_empty.status_code == 200
        assert not any(item["slug"] == "teste-detergentes-desengordurantes" for item in res_empty.json())


@pytest.mark.asyncio
async def test_guides_crud_and_public_detail_with_products(app_with_user, db_setup):
    # Cria departamento e produtos para vincular ao guia
    async with db_setup() as session:
        dept = Departamento(
            nome="Cozinha e Gordura",
            slug="cozinha-e-gordura",
            icone="pot",
        )
        session.add(dept)
        await session.flush()

        p1 = Produto(
            departamento_id=dept.id,
            nome="Desengordurante Potente 5L",
            slug="desengordurante-potente-5l",
            preco_de=Decimal("35.00"),
            preco_por=Decimal("29.90"),
            promo_fim=date.today() + timedelta(days=7),
            forma=Forma.GALAO.value,
            is_active=True,
        )
        p2 = Produto(
            departamento_id=dept.id,
            nome="Fibra Pesada Verde",
            slug="fibra-pesada-verde",
            preco_de=Decimal("5.50"),
            forma=Forma.ESPONJA.value,
            is_active=False,  # Produto inativo para testar CA-18
        )
        session.add(p1)
        session.add(p2)
        await session.commit()
        prod1_id = p1.id
        prod2_id = p2.id

    transport = ASGITransport(app=app_with_user)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Cria Guia no CMS com produtos
        res_create = await client.post(
            "/api/cms/guides",
            json={
                "slug": "como-limpar-chapa-hamburgueria",
                "title": "Como Limpar Chapa de Hamburgueria",
                "excerpt": "Passo a passo rápido sem estragar o aço.",
                "body_markdown": "1. Raspar a crosta\n2. Aplicar o produto",
                "guide_detail": {
                    "publico": "empresa",
                    "tempo_minutos": 15,
                    "etiqueta": "Chapa & Coifa",
                    "icone": "sparkle",
                    "dificuldade": "Média",
                },
                "produtos": [
                    {"produto_id": prod1_id, "quantidade": 1, "ordem": 0},
                    {"produto_id": prod2_id, "quantidade": 2, "ordem": 1},
                ],
            },
        )
        assert res_create.status_code == 201
        guide = res_create.json()
        assert guide["publico"] == "empresa"
        assert guide["tempo_minutos"] == 15
        assert len(guide["produtos"]) == 2
        guide_id = guide["id"]

        # 2. Publica o guia
        res_pub = await client.post(f"/api/cms/guides/{guide_id}/publish")
        assert res_pub.status_code == 200

        # 3. Lista pública de guias filtrando por público ?publico=empresa
        res_public_list = await client.get("/api/public/guides?publico=empresa")
        assert res_public_list.status_code == 200
        guides_empresa = res_public_list.json()
        assert any(g["slug"] == "como-limpar-chapa-hamburgueria" for g in guides_empresa)

        # 4. Detalhe público do guia (CA-18): traz os produtos com dados de preço e status is_active
        res_detail = await client.get("/api/public/guides/como-limpar-chapa-hamburgueria")
        assert res_detail.status_code == 200
        detail = res_detail.json()
        assert detail["tempo_display"] == "15 min"
        assert detail["etiqueta"] == "Chapa & Coifa"
        assert len(detail["produtos"]) == 2

        # Produto 1 ativo com preço de oferta
        item1 = next(item for item in detail["produtos"] if item["produto_id"] == prod1_id)
        assert item1["is_active"] is True
        assert item1["preco_atual"] == "29.90"
        assert item1["quantidade"] == 1

        # Produto 2 inativo
        item2 = next(item for item in detail["produtos"] if item["produto_id"] == prod2_id)
        assert item2["is_active"] is False
        assert item2["quantidade"] == 2


@pytest.mark.asyncio
async def test_guides_disabled_returns_404_and_empty_list(app_with_user, db_setup):
    # Desativa guias em SiteSettings (CA-19)
    async with db_setup() as session:
        settings = await session.get(SiteSettings, SITE_SETTINGS_SINGLETON_ID)
        if not settings:
            settings = SiteSettings(id=SITE_SETTINGS_SINGLETON_ID, guides_enabled=False)
            session.add(settings)
        else:
            settings.guides_enabled = False
        await session.commit()

    transport = ASGITransport(app=app_with_user)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Lista deve retornar vazia
        res_list = await client.get("/api/public/guides")
        assert res_list.status_code == 200
        assert res_list.json() == []

        # Detalhe deve retornar 404
        res_detail = await client.get("/api/public/guides/como-limpar-chapa-hamburgueria")
        assert res_detail.status_code == 404
