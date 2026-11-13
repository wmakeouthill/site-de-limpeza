from datetime import timedelta
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.application.services.catalog_service import CatalogService
from app.domain.entities.catalog import Departamento, Kit, KitItem, Produto
from app.domain.exceptions.catalog import ProductInUseConflictError
from app.domain.schemas.catalog import (
    ProdutoCreate,
    calcular_oferta,
    hoje_sao_paulo,
)
from app.infrastructure.repositories.catalog_repository import SqlAlchemyCatalogRepository


def test_ca02_calculo_oferta_ativa() -> None:
    """CA-02: Produto com preco_de 12.90, preco_por 9.90 e promo_fim amanha.

    Deve retornar promo_ativa = True, desconto_pct = 23 (-23%) e preco_atual = 9.90.
    """
    hoje = hoje_sao_paulo()
    amanha = hoje + timedelta(days=1)
    preco_de = Decimal("12.90")
    preco_por = Decimal("9.90")

    ativa, desconto, atual = calcular_oferta(
        preco_de=preco_de,
        preco_por=preco_por,
        promo_inicio=hoje,
        promo_fim=amanha,
        hoje=hoje,
    )

    assert ativa is True
    assert desconto == 23
    assert atual == Decimal("9.90")


def test_ca03_oferta_expirada_apos_meia_noite() -> None:
    """CA-03: Passada a meia-noite (Sao Paulo) do dia seguinte a promo_fim.

    O calculo deve automaticamente retornar promo_ativa = False e preco_atual = 12.90 sem build.
    """
    hoje = hoje_sao_paulo()
    ontem = hoje - timedelta(days=1)
    preco_de = Decimal("12.90")
    preco_por = Decimal("9.90")

    # A oferta terminou ontem
    ativa, desconto, atual = calcular_oferta(
        preco_de=preco_de,
        preco_por=preco_por,
        promo_inicio=ontem - timedelta(days=5),
        promo_fim=ontem,
        hoje=hoje,
    )

    assert ativa is False
    assert desconto is None
    assert atual == Decimal("12.90")


def test_ca04_oferta_futura_e_privacidade_comercial_publica() -> None:
    """CA-04: Oferta com promo_inicio amanha.

    Na consulta publica hoje, o produto vem com promo_ativa = False, preco_por = None e datas nulas.
    """
    hoje = hoje_sao_paulo()
    amanha = hoje + timedelta(days=1)
    fim = hoje + timedelta(days=7)

    produto = Produto(
        id="prod-1",
        departamento_id="dept-1",
        nome="Detergente Neutro",
        slug="detergente-neutro",
        preco_de=Decimal("5.00"),
        preco_por=Decimal("3.50"),
        promo_inicio=amanha,
        promo_fim=fim,
        is_active=True,
    )

    # Verifica o cálculo
    ativa, desconto, atual = calcular_oferta(
        preco_de=produto.preco_de,
        preco_por=produto.preco_por,
        promo_inicio=produto.promo_inicio,
        promo_fim=produto.promo_fim,
        hoje=hoje,
    )
    assert ativa is False
    assert desconto is None
    assert atual == Decimal("5.00")

    # Verifica privacidade na serialização pública
    public_dto = CatalogService.to_public_produto(produto, hoje=hoje)
    assert public_dto.promo_ativa is False
    assert public_dto.preco_por is None
    assert public_dto.promo_inicio is None
    assert public_dto.promo_fim is None
    assert public_dto.preco_de == "5.00"
    assert public_dto.preco_atual == "5.00"


def test_ca05_validacao_regras_oferta_no_editor() -> None:
    """CA-05: Validacoes no editor de produto.

    1. preco_por >= preco_de levanta erro.
    2. preco_por presente sem promo_fim levanta erro.
    3. promo_inicio posterior a promo_fim levanta erro.
    """
    amanha = hoje_sao_paulo() + timedelta(days=1)

    # 1. preco_por igual a preco_de
    with pytest.raises(ValidationError) as exc1:
        ProdutoCreate(
            departamento_id="dept-1",
            nome="Sabão em Barra",
            preco_de=Decimal("10.00"),
            preco_por=Decimal("10.00"),
            promo_fim=amanha,
        )
    assert "Preço promocional deve ser menor que o preço original" in str(exc1.value)

    # 1. preco_por maior que preco_de
    with pytest.raises(ValidationError) as exc2:
        ProdutoCreate(
            departamento_id="dept-1",
            nome="Sabão em Barra",
            preco_de=Decimal("10.00"),
            preco_por=Decimal("12.00"),
            promo_fim=amanha,
        )
    assert "Preço promocional deve ser menor que o preço original" in str(exc2.value)

    # 2. preco_por sem promo_fim
    with pytest.raises(ValidationError) as exc3:
        ProdutoCreate(
            departamento_id="dept-1",
            nome="Sabão em Barra",
            preco_de=Decimal("10.00"),
            preco_por=Decimal("8.00"),
            promo_fim=None,
        )
    assert "Data de término da oferta é obrigatória" in str(exc3.value)

    # 3. promo_inicio posterior a promo_fim
    with pytest.raises(ValidationError) as exc4:
        ProdutoCreate(
            departamento_id="dept-1",
            nome="Sabão em Barra",
            preco_de=Decimal("10.00"),
            preco_por=Decimal("8.00"),
            promo_inicio=amanha + timedelta(days=2),
            promo_fim=amanha,
        )
    assert "Data de início da oferta não pode ser posterior" in str(exc4.value)


@pytest.mark.asyncio
async def test_ca22_bloqueio_exclusao_produto_em_uso(tmp_path) -> None:
    """CA-22: Bloqueio de exclusao de produto vinculado a kit.

    Deve levantar ProductInUseConflictError com motivo e sugestao de desativar.
    """
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.infrastructure.database.base import Base

    db_path = tmp_path / "catalog_test.db"
    url = f"sqlite+aiosqlite:///{db_path.as_posix()}"
    engine = create_async_engine(url)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    try:
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            repo = SqlAlchemyCatalogRepository(db)
            service = CatalogService(repo)

            dept = Departamento(nome="Limpeza Geral", slug="limpeza-geral")
            db.add(dept)
            await db.flush()

            prod = Produto(
                departamento_id=dept.id,
                nome="Desinfetante Floral 2L",
                slug="desinfetante-floral-2l",
                preco_de=Decimal("8.50"),
            )
            db.add(prod)
            await db.flush()

            kit = Kit(
                nome="Kit Escritório Básico",
                slug="kit-escritorio",
                publico="escritorio",
            )
            db.add(kit)
            await db.flush()

            item = KitItem(
                kit_id=kit.id,
                produto_id=prod.id,
                quantidade=2,
            )
            db.add(item)
            await db.commit()

            # Tenta excluir o produto vinculado ao kit
            with pytest.raises(ProductInUseConflictError) as exc:
                await service.delete_produto(prod.id)

            msg = str(exc.value)
            assert "associado a 1 kit(s)" in msg
            assert "Sugestão: desative o produto em vez de excluí-lo" in msg
    finally:
        await engine.dispose()
