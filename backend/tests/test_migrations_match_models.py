import os
import subprocess
import sys
from datetime import UTC, date, datetime
from decimal import Decimal
from pathlib import Path

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.domain.entities.campaign_source_link import CampaignSourceLink
from app.domain.entities.catalog import Departamento, Kit, KitItem, Produto
from app.domain.entities.content import ArticleDetail, ContentEntry, ContentStatus, ContentType
from app.domain.entities.enums import (
    CategoriaArtigo,
    Forma,
    Icone,
    PublicoGuia,
    PublicoPromocao,
    TipoAcao,
)
from app.domain.entities.guide import GuideDetail, GuideProduto
from app.domain.entities.promocao import Promocao
from app.domain.entities.site import SiteScope
from app.domain.entities.site_event import DailyAnalyticsRollup

BACKEND_DIR = Path(__file__).resolve().parents[1]


@pytest.mark.asyncio
async def test_models_work_on_a_database_built_by_migrations(tmp_path) -> None:
    """Os outros testes criam o schema com create_all; producao usa as migrations.

    A divergencia entre os dois derrubaria o funcionamento em producao.
    """
    url = f"sqlite+aiosqlite:///{(tmp_path / 'migrated.db').as_posix()}"
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=BACKEND_DIR,
        env={**os.environ, "DATABASE_URL": url, "ENVIRONMENT": "test"},
        check=True,
        capture_output=True,
    )

    engine = create_async_engine(url)
    try:
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            db.add(
                CampaignSourceLink(
                    identifier="instagram-bio", title="Bio", source_url="https://instagram.com/x"
                )
            )
            db.add(
                DailyAnalyticsRollup(
                    site=SiteScope.FALCAO, day=date(2026, 10, 1), payload={"pageviews": 1}
                )
            )

            # Teste de persistência e integridade das tabelas de catálogo
            dept = Departamento(
                nome="Cloro e Desinfecção",
                slug="cloro-e-desinfeccao",
                icone=Icone.DROP.value,
                uso="Para pisos e quintais",
                cuidado="Usar luvas",
                ordem=1,
            )
            db.add(dept)
            await db.flush()

            prod = Produto(
                departamento_id=dept.id,
                nome="Água Sanitária 5L",
                slug="agua-sanitaria-5l",
                marca="Falcão",
                tamanho="5 L",
                forma=Forma.GALAO.value,
                preco_de=Decimal("15.90"),
                preco_por=Decimal("12.90"),
                promo_inicio=date(2026, 10, 1),
                promo_fim=date(2026, 10, 31),
                embalagem_grande=True,
            )
            db.add(prod)
            await db.flush()

            kit = Kit(
                nome="Kit Restaurante",
                slug="kit-restaurante",
                descricao="Completo para cozinha comercial",
                publico="restaurante",
            )
            db.add(kit)
            await db.flush()

            kit_item = KitItem(
                kit_id=kit.id,
                produto_id=prod.id,
                quantidade=3,
                ordem=1,
            )
            db.add(kit_item)

            promo = Promocao(
                titulo="Oferta de Inauguração",
                texto="Venha conhecer nossa nova loja no Anil!",
                tipo_acao=TipoAcao.PRODUTO.value,
                produto_id=prod.id,
                publico=PublicoPromocao.TODOS.value,
                data_inicio=datetime(2026, 10, 1, 0, 0, tzinfo=UTC),
                data_fim=datetime(2026, 10, 31, 23, 59, tzinfo=UTC),
                prioridade=10,
            )
            db.add(promo)

            # Teste de Guias e Artigos com categoria
            article = ContentEntry(
                content_type=ContentType.ARTICLE,
                site=SiteScope.FALCAO,
                status=ContentStatus.PUBLISHED,
                slug="teste-artigo-categoria",
                title="Dicas de Limpeza",
                excerpt="Como manter a casa limpa",
                body_markdown="Texto do artigo",
                created_by="editor@teste.com",
                updated_by="editor@teste.com",
            )
            db.add(article)
            await db.flush()

            article_detail = ArticleDetail(
                content_entry_id=article.id,
                categoria=CategoriaArtigo.DICAS.value,
                area="Limpeza Doméstica",
                reading_time="3 min",
            )
            db.add(article_detail)

            guide = ContentEntry(
                content_type=ContentType.GUIDE,
                site=SiteScope.FALCAO,
                status=ContentStatus.PUBLISHED,
                slug="como-limpar-banheiro",
                title="Como Limpar Banheiro Rápido",
                excerpt="Passo a passo definitivo",
                body_markdown="Passo 1: aplicar desinfetante",
                created_by="editor@teste.com",
                updated_by="editor@teste.com",
            )
            db.add(guide)
            await db.flush()

            guide_detail = GuideDetail(
                content_entry_id=guide.id,
                publico=PublicoGuia.CASA,
                tempo_minutos=20,
                etiqueta="Banheiro",
                icone="drop",
                dificuldade="Fácil",
            )
            db.add(guide_detail)

            guide_prod = GuideProduto(
                guide_id=guide.id,
                produto_id=prod.id,
                quantidade=2,
                ordem=1,
            )
            db.add(guide_prod)

            await db.commit()

            # Asserções
            assert await db.get(CampaignSourceLink, "instagram-bio") is not None
            rollups = (await db.scalars(select(DailyAnalyticsRollup))).all()
            assert [rollup.payload for rollup in rollups] == [{"pageviews": 1}]

            loaded_promo = await db.get(Promocao, promo.id)
            assert loaded_promo is not None
            assert loaded_promo.titulo == "Oferta de Inauguração"
            assert loaded_promo.prioridade == 10
            assert loaded_promo.produto_id == prod.id

            loaded_dept = await db.get(Departamento, dept.id)
            assert loaded_dept is not None
            assert loaded_dept.nome == "Cloro e Desinfecção"

            loaded_prod = await db.get(Produto, prod.id)
            assert loaded_prod is not None
            assert loaded_prod.preco_de == Decimal("15.90")
            assert loaded_prod.preco_por == Decimal("12.90")
            assert loaded_prod.departamento_id == dept.id

            loaded_kit = await db.get(Kit, kit.id)
            assert loaded_kit is not None
            assert loaded_kit.publico == "restaurante"

            loaded_item = await db.get(KitItem, kit_item.id)
            assert loaded_item is not None
            assert loaded_item.quantidade == 3

            loaded_article = await db.get(ContentEntry, article.id)
            assert loaded_article is not None
            assert loaded_article.title == "Dicas de Limpeza"
            loaded_art_detail = await db.get(ArticleDetail, article.id)
            assert loaded_art_detail is not None
            assert loaded_art_detail.categoria == "dicas"

            loaded_guide = await db.get(ContentEntry, guide.id)
            assert loaded_guide is not None
            assert loaded_guide.title == "Como Limpar Banheiro Rápido"
            loaded_guide_detail = await db.get(GuideDetail, guide.id)
            assert loaded_guide_detail is not None
            assert loaded_guide_detail.tempo_minutos == 20
            assert loaded_guide_detail.etiqueta == "Banheiro"

            loaded_guide_prod = await db.get(GuideProduto, guide_prod.id)
            assert loaded_guide_prod is not None
            assert loaded_guide_prod.quantidade == 2
            assert loaded_guide_prod.produto_id == prod.id
    finally:
        await engine.dispose()
