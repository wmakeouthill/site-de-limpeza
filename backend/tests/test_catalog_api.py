# ruff: noqa: E402
import os
from datetime import timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.application.services.catalog_service import CatalogService
from app.domain.entities.catalog import Departamento, Kit, KitItem, Produto
from app.domain.schemas.catalog import hoje_sao_paulo
from app.infrastructure.config.settings import get_settings
from app.infrastructure.database.base import Base
from app.infrastructure.repositories.catalog_repository import SqlAlchemyCatalogRepository
from app.infrastructure.security.cms_session import CmsUser
from app.interfaces.api.v1.dependencies.auth import require_cms_user
from app.interfaces.api.v1.dependencies.services import get_catalog_service

os.environ["PUBLIC_CACHE_L2_ENABLED"] = "false"
get_settings.cache_clear()
from app.main import create_app


@pytest.fixture
async def catalog_setup(tmp_path):
    db_file = tmp_path / "test_api_catalog.db"
    url = f"sqlite+aiosqlite:///{db_file.as_posix()}"
    engine = create_async_engine(url)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    yield session_factory

    await engine.dispose()


def test_ca26_rotas_cms_exigem_autenticacao() -> None:
    """CA-26: Sem sessao no CMS, chamadas a /api/cms/* retornam 401."""
    app = create_app()
    client = TestClient(app)

    # Nenhuma sessão autenticada fornecida
    assert client.get("/api/cms/departamentos").status_code == 401
    assert client.get("/api/cms/produtos").status_code == 401
    assert client.get("/api/cms/kits").status_code == 401
    assert client.post("/api/cms/departamentos", json={"nome": "Cloro"}).status_code == 401
    assert client.post("/api/cms/produtos", json={"nome": "Água"}).status_code == 401
    assert client.post("/api/cms/kits", json={"nome": "Kit"}).status_code == 401


@pytest.mark.asyncio
async def test_crud_departamentos_cms(catalog_setup) -> None:
    session_factory = catalog_setup

    async def override_get_service():
        async with session_factory() as session:
            repo = SqlAlchemyCatalogRepository(session)
            return CatalogService(repo)

    app = create_app()
    app.dependency_overrides[require_cms_user] = lambda: CmsUser(
        email="admin@falcaolimpeza.com.br", name="Admin Falcão", object_id="uid-1"
    )

    # 1. Cria departamento
    with TestClient(app) as client:
        # Override de serviço por chamada
        async with session_factory() as session:
            app.dependency_overrides[get_catalog_service] = lambda: CatalogService(
                SqlAlchemyCatalogRepository(session)
            )

            res = client.post(
                "/api/cms/departamentos",
                json={
                    "nome": "Lavanderia e Roupas",
                    "icone": "shirt",
                    "uso": "Para tecidos delicados e pesados",
                },
            )
            assert res.status_code == 201
            data = res.json()
            assert data["nome"] == "Lavanderia e Roupas"
            assert data["slug"] == "lavanderia-e-roupas"
            assert data["icone"] == "shirt"
            dept_id = data["id"]

            # 2. Lista departamentos
            list_res = client.get("/api/cms/departamentos")
            assert list_res.status_code == 200
            assert any(d["id"] == dept_id for d in list_res.json())

            # 3. Atualiza departamento
            up_res = client.put(
                f"/api/cms/departamentos/{dept_id}",
                json={"uso": "Uso atualizado"},
            )
            assert up_res.status_code == 200
            assert up_res.json()["uso"] == "Uso atualizado"

            # 4. Remove departamento
            del_res = client.delete(f"/api/cms/departamentos/{dept_id}")
            assert del_res.status_code == 204


@pytest.mark.asyncio
async def test_crud_produtos_cms_e_regras_oferta(catalog_setup) -> None:
    session_factory = catalog_setup
    hoje = hoje_sao_paulo()
    amanha = hoje + timedelta(days=1)

    app = create_app()
    app.dependency_overrides[require_cms_user] = lambda: CmsUser(
        email="admin@falcaolimpeza.com.br", name="Admin Falcão", object_id="uid-1"
    )

    async with session_factory() as session:
        app.dependency_overrides[get_catalog_service] = lambda: CatalogService(
            SqlAlchemyCatalogRepository(session)
        )

        with TestClient(app) as client:
            # Cria departamento para o produto
            dept_res = client.post(
                "/api/cms/departamentos",
                json={"nome": "Pisos e Superfícies", "icone": "bucket"},
            )
            dept_id = dept_res.json()["id"]

            # 1. Criação com oferta inválida (preco_por >= preco_de) -> 422 (CA-05)
            inv_res = client.post(
                "/api/cms/produtos",
                json={
                    "departamento_id": dept_id,
                    "nome": "Cera Líquida",
                    "preco_de": "20.00",
                    "preco_por": "25.00",
                    "promo_fim": amanha.isoformat(),
                },
            )
            assert inv_res.status_code == 422

            # 2. Criação válida de produto com oferta ativa (CA-02)
            prod_res = client.post(
                "/api/cms/produtos",
                json={
                    "departamento_id": dept_id,
                    "nome": "Cera Líquida Incolor",
                    "marca": "Falcão",
                    "tamanho": "1 L",
                    "preco_de": "20.00",
                    "preco_por": "15.00",
                    "promo_inicio": hoje.isoformat(),
                    "promo_fim": amanha.isoformat(),
                },
            )
            assert prod_res.status_code == 201
            prod_data = prod_res.json()
            assert prod_data["promo_ativa"] is True
            assert prod_data["desconto_pct"] == 25
            assert prod_data["preco_atual"] == "15.00"
            prod_id = prod_data["id"]

            # 3. Consulta individual no CMS
            get_res = client.get(f"/api/cms/produtos/{prod_id}")
            assert get_res.status_code == 200
            assert get_res.json()["nome"] == "Cera Líquida Incolor"

            # 4. Atualiza preço_de e remove preco_por
            up_res = client.put(
                f"/api/cms/produtos/{prod_id}",
                json={"preco_de": "22.00", "preco_por": None},
            )
            assert up_res.status_code == 200
            assert up_res.json()["preco_de"] == "22.00"
            assert up_res.json()["promo_ativa"] is False

            # 4b. Foto com enquadramento; null remove; posição fora do formato não entra (vira CSS)
            foto = {"imagem_url": "/media/a.webp", "imagem_posicao": "30.5% 70%", "imagem_zoom": 250}
            foto_res = client.put(f"/api/cms/produtos/{prod_id}", json=foto)
            assert foto_res.status_code == 200
            assert {k: foto_res.json()[k] for k in foto} == foto
            sem_foto = client.put(f"/api/cms/produtos/{prod_id}", json={"imagem_url": None})
            assert sem_foto.json()["imagem_url"] is None
            ruim = client.put(f"/api/cms/produtos/{prod_id}", json={"imagem_posicao": "50%;color:red"})
            assert ruim.status_code == 422

            # 5. Remove produto
            assert client.delete(f"/api/cms/produtos/{prod_id}").status_code == 204


@pytest.mark.asyncio
async def test_ca22_bloqueio_exclusao_produto_em_uso_via_api(catalog_setup) -> None:
    session_factory = catalog_setup
    app = create_app()
    app.dependency_overrides[require_cms_user] = lambda: CmsUser(
        email="admin@falcaolimpeza.com.br", name="Admin Falcão", object_id="uid-1"
    )

    async with session_factory() as session:
        app.dependency_overrides[get_catalog_service] = lambda: CatalogService(
            SqlAlchemyCatalogRepository(session)
        )

        with TestClient(app) as client:
            dept_res = client.post(
                "/api/cms/departamentos",
                json={"nome": "Cozinha e Louça", "icone": "cup"},
            )
            dept_id = dept_res.json()["id"]

            prod_res = client.post(
                "/api/cms/produtos",
                json={
                    "departamento_id": dept_id,
                    "nome": "Detergente Maçã 500ml",
                    "preco_de": "3.50",
                },
            )
            prod_id = prod_res.json()["id"]

            # Cria kit usando o produto
            kit_res = client.post(
                "/api/cms/kits",
                json={
                    "nome": "Kit Cozinha Comercial",
                    "publico": "restaurante",
                    "itens": [{"produto_id": prod_id, "quantidade": 4}],
                },
            )
            assert kit_res.status_code == 201

            # Tenta excluir o produto -> 409 Conflict (CA-22)
            del_res = client.delete(f"/api/cms/produtos/{prod_id}")
            assert del_res.status_code == 409
            assert "associado a 1 kit(s)" in del_res.json()["detail"]


@pytest.mark.asyncio
async def test_rotas_publicas_catalogo(catalog_setup) -> None:
    session_factory = catalog_setup
    app = create_app()
    hoje = hoje_sao_paulo()
    amanha = hoje + timedelta(days=1)

    async with session_factory() as session:
        repo = SqlAlchemyCatalogRepository(session)
        service = CatalogService(repo)
        app.dependency_overrides[get_catalog_service] = lambda: service

        # Prepara dados
        dept = Departamento(nome="Banheiro e Pias", slug="banheiro-e-pias", icone="pot")
        session.add(dept)
        await session.flush()

        prod_oferta = Produto(
            departamento_id=dept.id,
            nome="Desinfetante Pinho 2L",
            slug="desinfetante-pinho-2l",
            preco_de=Decimal("10.00"),
            preco_por=Decimal("8.00"),
            promo_inicio=hoje,
            promo_fim=amanha,
        )
        prod_normal = Produto(
            departamento_id=dept.id,
            nome="Cloro Gel 1L",
            slug="cloro-gel-1l",
            preco_de=Decimal("12.00"),
        )
        session.add_all([prod_oferta, prod_normal])
        await session.flush()

        kit = Kit(
            nome="Kit Banheiro Empresarial",
            slug="kit-banheiro-empresarial",
            publico="empresa",
        )
        session.add(kit)
        await session.flush()

        kit_item = KitItem(kit_id=kit.id, produto_id=prod_oferta.id, quantidade=2)
        session.add(kit_item)
        await session.commit()

        with TestClient(app) as client:
            # 1. Departamentos públicos
            d_res = client.get("/api/public/departamentos")
            assert d_res.status_code == 200
            assert any(d["slug"] == "banheiro-e-pias" for d in d_res.json())

            # 2. Produtos públicos geral
            p_res = client.get("/api/public/produtos")
            assert p_res.status_code == 200
            assert len(p_res.json()) == 2

            # 3. Filtro por departamento
            p_dept = client.get("/api/public/produtos", params={"departamento": "banheiro-e-pias"})
            assert p_dept.status_code == 200
            assert len(p_dept.json()) == 2

            # 4. Filtro por oferta
            p_off = client.get("/api/public/produtos", params={"oferta": "true"})
            assert p_off.status_code == 200
            assert len(p_off.json()) == 1
            assert p_off.json()[0]["slug"] == "desinfetante-pinho-2l"
            assert p_off.json()[0]["preco_por"] == "8.00"

            # 5. Detalhe público
            det_res = client.get("/api/public/produtos/desinfetante-pinho-2l")
            assert det_res.status_code == 200
            assert det_res.json()["nome"] == "Desinfetante Pinho 2L"

            # 6. Detalhe de inexistente -> 404
            not_found = client.get("/api/public/produtos/nao-existe")
            assert not_found.status_code == 404

            # 7. Kits públicos
            k_res = client.get("/api/public/kits")
            assert k_res.status_code == 200
            assert len(k_res.json()) == 1
            assert k_res.json()[0]["slug"] == "kit-banheiro-empresarial"
            assert len(k_res.json()[0]["itens"]) == 1
            assert k_res.json()[0]["itens"][0]["quantidade"] == 2
