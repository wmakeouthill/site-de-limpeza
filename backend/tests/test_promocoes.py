from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from pydantic import ValidationError

from app.application.services.promocao_service import PromocaoService, calcular_situacao
from app.domain.entities.enums import TipoAcao
from app.domain.entities.promocao import Promocao
from app.domain.repositories.promocao_repository import PromocaoRepository
from app.domain.schemas.promocao import PromocaoCreate

TZ_SP = ZoneInfo("America/Sao_Paulo")


def test_valida_caminho_interno_seguro_ca17():
    now = datetime.now(TZ_SP)
    fim = now + timedelta(days=7)

    # 1. Caminho válido relativo interno
    valida = PromocaoCreate(
        titulo="Promoção Válida",
        tipo_acao=TipoAcao.LINK,
        cta_texto="Ver produtos",
        cta_caminho="/produtos?oferta=1",
        data_inicio=now,
        data_fim=fim,
    )
    assert valida.cta_caminho == "/produtos?oferta=1"

    # 2. Bloqueio de URL externa com http/https (CA-17)
    with pytest.raises(ValidationError) as exc_info:
        PromocaoCreate(
            titulo="Promoção com Golpe",
            tipo_acao=TipoAcao.LINK,
            cta_texto="Ir para site externo",
            cta_caminho="https://site-malicioso.com",
            data_inicio=now,
            data_fim=fim,
        )
    assert "sem protocolos externos" in str(exc_info.value)

    # 3. Bloqueio de protocolo // (protocol-relative URL)
    with pytest.raises(ValidationError) as exc_info:
        PromocaoCreate(
            titulo="Promoção com Protocol Relative",
            tipo_acao=TipoAcao.LINK,
            cta_texto="Golpe",
            cta_caminho="//site-externo.com/login",
            data_inicio=now,
            data_fim=fim,
        )
    assert "sem protocolos externos" in str(exc_info.value)

    # 4. Bloqueio de barra invertida (backslash bypass)
    with pytest.raises(ValidationError) as exc_info:
        PromocaoCreate(
            titulo="Promoção com Barra Invertida",
            tipo_acao=TipoAcao.LINK,
            cta_texto="Golpe",
            cta_caminho="/\\site.com",
            data_inicio=now,
            data_fim=fim,
        )
    assert "sem protocolos externos" in str(exc_info.value)


def test_valida_cupom_e_produto():
    now = datetime.now(TZ_SP)
    fim = now + timedelta(days=7)

    # Cupom vazio ou com espaço deve falhar
    with pytest.raises(ValidationError):
        PromocaoCreate(
            titulo="Cupom Inválido",
            tipo_acao=TipoAcao.CUPOM,
            codigo_cupom="COM ESPACO",
            data_inicio=now,
            data_fim=fim,
        )

    # Produto sem produto_id deve falhar
    with pytest.raises(ValidationError):
        PromocaoCreate(
            titulo="Produto sem ID",
            tipo_acao=TipoAcao.PRODUTO,
            produto_id=None,
            data_inicio=now,
            data_fim=fim,
        )


def test_valida_datas_inicio_fim():
    now = datetime.now(TZ_SP)
    passado = now - timedelta(days=5)

    with pytest.raises(ValidationError):
        PromocaoCreate(
            titulo="Data Invertida",
            data_inicio=now,
            data_fim=passado,
        )


def test_calcula_situacao_promocao():
    now = datetime.now(TZ_SP)

    # 1. Desligada
    p_desligada = Promocao(
        titulo="Inativa",
        data_inicio=now - timedelta(days=1),
        data_fim=now + timedelta(days=1),
        is_active=False,
    )
    assert calcular_situacao(p_desligada, now) == "desligada"

    # 2. Agendada
    p_agendada = Promocao(
        titulo="Futura",
        data_inicio=now + timedelta(days=1),
        data_fim=now + timedelta(days=5),
        is_active=True,
    )
    assert calcular_situacao(p_agendada, now) == "agendada"

    # 3. Encerrada
    p_encerrada = Promocao(
        titulo="Passada",
        data_inicio=now - timedelta(days=5),
        data_fim=now - timedelta(days=1),
        is_active=True,
    )
    assert calcular_situacao(p_encerrada, now) == "encerrada"

    # 4. No ar
    p_no_ar = Promocao(
        titulo="Atual",
        data_inicio=now - timedelta(days=1),
        data_fim=now + timedelta(days=1),
        is_active=True,
    )
    assert calcular_situacao(p_no_ar, now) == "no_ar"


@pytest.mark.asyncio
async def test_ordena_promocoes_ativas_por_prioridade_ca13(tmp_path):
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.infrastructure.database.base import Base

    db_path = tmp_path / "promocoes_test.db"
    url = f"sqlite+aiosqlite:///{db_path.as_posix()}"
    engine = create_async_engine(url)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    try:
        async with async_sessionmaker(engine, expire_on_commit=False)() as db:
            repo = PromocaoRepository(db)
            service = PromocaoService(repo)

            now = datetime.now(TZ_SP)

            # Cria duas promoções ativas: uma prioridade 5 e outra prioridade 10
            p_baixa = Promocao(
                titulo="Aviso Secundário",
                prioridade=5,
                data_inicio=now - timedelta(days=1),
                data_fim=now + timedelta(days=1),
                is_active=True,
            )
            p_alta = Promocao(
                titulo="Oferta Principal da Semana",
                prioridade=10,
                data_inicio=now - timedelta(days=1),
                data_fim=now + timedelta(days=1),
                is_active=True,
            )

            db.add(p_baixa)
            db.add(p_alta)
            await db.commit()

            ativas = await service.get_active_promotions()
            assert len(ativas) >= 2
            # A primeira da lista DEVE ser a de maior prioridade (CA-13)
            assert ativas[0].id == p_alta.id
            assert ativas[0].prioridade == 10
            assert ativas[1].id == p_baixa.id
    finally:
        await engine.dispose()
