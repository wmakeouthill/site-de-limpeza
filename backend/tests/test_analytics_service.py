from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta

import pytest
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.application.services.analytics_service import AnalyticsService
from app.domain.entities.campaign_source_link import CampaignSourceLink
from app.domain.entities.site import SiteScope
from app.domain.entities.site_event import (
    SiteEvent,
    SiteEventType,
    lead_submission_target,
)
from app.domain.schemas.analytics import SiteEventCreate
from app.infrastructure.database.base import Base
from app.infrastructure.repositories.campaign_source_link_repository import (
    SqlAlchemyCampaignSourceLinkRepository,
)
from app.infrastructure.repositories.site_event_repository import (
    SqlAlchemySiteEventRepository,
)


@pytest_asyncio.fixture
async def session() -> AsyncGenerator[AsyncSession, None]:
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    async with async_sessionmaker(engine, expire_on_commit=False)() as db:
        yield db
    await engine.dispose()


def _event(session_id: str, event: SiteEventType, **kwargs) -> SiteEventCreate:
    return SiteEventCreate(session_id=session_id, event=event, **kwargs)


@pytest.mark.asyncio
async def test_record_grava_o_site_do_host_e_nao_o_do_corpo(
    session: AsyncSession,
) -> None:
    service = AnalyticsService(SqlAlchemySiteEventRepository(session))

    gravados = await service.record(
        [_event("sessao-0001", SiteEventType.PAGEVIEW, page="/promo/")],
        site=SiteScope.FALCAO,
    )

    assert gravados == 1
    painel = await service.dashboard(site=SiteScope.FALCAO, days=30)
    assert painel.overview.pageviews == 1


@pytest.mark.asyncio
async def test_record_usa_horario_de_recebimento_para_reter_eventos(
    session: AsyncSession,
) -> None:
    service = AnalyticsService(SqlAlchemySiteEventRepository(session))
    before = datetime.now(UTC)

    await service.record(
        [
            _event(
                "sessao-ocorrencia",
                SiteEventType.PAGEVIEW,
                occurred_at=datetime(2999, 1, 1, tzinfo=UTC),
            )
        ],
        site=SiteScope.FALCAO,
    )

    persisted = (await session.execute(select(SiteEvent))).scalar_one()
    after = datetime.now(UTC)
    # O browser controla o payload: data futura nao pode burlar a retenÃ§Ã£o.
    received_at = persisted.created_at.replace(tzinfo=UTC)
    assert before <= received_at <= after


@pytest.mark.asyncio
async def test_record_preserva_ocorrencia_valida_sem_usar_data_forjada(
    session: AsyncSession,
) -> None:
    service = AnalyticsService(SqlAlchemySiteEventRepository(session))
    now = datetime.now(UTC)
    first_at = now - timedelta(minutes=2)
    second_at = now - timedelta(minutes=1)

    await service.record(
        [
            _event("sessao-ocorrencia", SiteEventType.PAGEVIEW, occurred_at=first_at),
            _event("sessao-ocorrencia", SiteEventType.CLICK, occurred_at=second_at),
            _event(
                "sessao-ocorrencia",
                SiteEventType.FORM_SUBMIT,
                occurred_at=datetime(2999, 1, 1, tzinfo=UTC),
            ),
        ],
        site=SiteScope.FALCAO,
    )

    events = {
        event.event: event
        for event in (await session.execute(select(SiteEvent))).scalars()
    }

    assert events[SiteEventType.PAGEVIEW].occurred_at.replace(tzinfo=UTC) == first_at
    assert events[SiteEventType.CLICK].occurred_at.replace(tzinfo=UTC) == second_at
    assert events[SiteEventType.FORM_SUBMIT].occurred_at.replace(tzinfo=UTC) < datetime(
        2100, 1, 1, tzinfo=UTC
    )


@pytest.mark.asyncio
async def test_record_normaliza_dimensoes_de_atribuicao_e_descarta_campos_livres(
    session: AsyncSession,
) -> None:
    service = AnalyticsService(SqlAlchemySiteEventRepository(session))

    await service.record(
        [
            _event(
                "sessao-atribuicao",
                SiteEventType.PAGEVIEW,
                attribution_id="atr-7c31f879-2e79-452f-b4d7-4da76c0a21ac",
                utm_source="Meta Ads",
                utm_medium="Paid Social",
                utm_campaign="Lancamento 2026",
                utm_term="Gestao",
                utm_content="Reel 03",
                placement="Feed",
                referrer="facebook.com",
            )
        ],
        site=SiteScope.FALCAO,
    )

    persisted = (await session.execute(select(SiteEvent))).scalar_one()

    assert persisted.attribution_id == "atr-7c31f879-2e79-452f-b4d7-4da76c0a21ac"
    assert persisted.utm_source == "meta-ads"
    assert persisted.utm_medium == "paid-social"
    assert persisted.utm_campaign == "lancamento-2026"
    assert persisted.utm_term == "gestao"
    assert persisted.utm_content == "reel-03"
    assert persisted.placement == "feed"
    assert persisted.referrer == "facebook.com"


@pytest.mark.asyncio
async def test_funil_conta_sessoes_distintas_e_percentual(
    session: AsyncSession,
) -> None:
    service = AnalyticsService(SqlAlchemySiteEventRepository(session))
    # 4 entram, 2 clicam, 1 envia. A sessao "a" repete pageview de proposito.
    await service.record(
        [
            _event("sessao-000a", SiteEventType.PAGEVIEW),
            _event("sessao-000a", SiteEventType.PAGEVIEW),
            _event("sessao-000b", SiteEventType.PAGEVIEW),
            _event("sessao-000c", SiteEventType.PAGEVIEW),
            _event("sessao-000d", SiteEventType.PAGEVIEW),
            _event("sessao-000a", SiteEventType.CLICK, target="Quero participar"),
            _event("sessao-000b", SiteEventType.CLICK, target="Quero participar"),
            _event("sessao-000a", SiteEventType.FORM_SUBMIT),
        ],
        site=SiteScope.FALCAO,
    )

    painel = await service.dashboard(site=SiteScope.FALCAO, days=30)
    passos = {step.step: step for step in painel.funnel}

    assert painel.overview.visitors == 4  # sessoes distintas, nao pageviews
    assert painel.overview.pageviews == 5
    assert passos["pageview"].sessions == 4
    assert passos["click"].sessions == 2
    assert passos["click"].rate == 50.0
    assert passos["form_submit"].sessions == 1
    assert passos["form_submit"].rate == 25.0
    # 2 das 4 sessoes so viram a pagina e foram embora.
    assert painel.overview.bounce_rate == 50.0


@pytest.mark.asyncio
async def test_permanencia_soma_os_deltas_da_sessao(session: AsyncSession) -> None:
    service = AnalyticsService(SqlAlchemySiteEventRepository(session))
    # O track.js manda delta por ida/volta na aba: 3s + 7s = 10s numa sessao.
    await service.record(
        [
            _event("sessao-000a", SiteEventType.ENGAGEMENT, dwell_ms=3000),
            _event("sessao-000a", SiteEventType.ENGAGEMENT, dwell_ms=7000),
            _event("sessao-000b", SiteEventType.ENGAGEMENT, dwell_ms=40000),
            _event("sessao-000c", SiteEventType.ENGAGEMENT, dwell_ms=1000),
        ],
        site=SiteScope.FALCAO,
    )

    painel = await service.dashboard(site=SiteScope.FALCAO, days=30)
    # Totais por sessao: 1000, 10000, 40000 -> mediana 10000.
    assert painel.overview.median_dwell_ms == 10000


@pytest.mark.asyncio
async def test_ranking_de_cliques_traz_a_posicao_media_no_botao(
    session: AsyncSession,
) -> None:
    service = AnalyticsService(SqlAlchemySiteEventRepository(session))
    await service.record(
        [
            _event(
                "sessao-000a",
                SiteEventType.CLICK,
                target="Quero participar",
                pos_x=40,
                pos_y=50,
            ),
            _event(
                "sessao-000b",
                SiteEventType.CLICK,
                target="Quero participar",
                pos_x=60,
                pos_y=50,
            ),
            _event(
                "sessao-000c",
                SiteEventType.CLICK,
                target="WhatsApp",
                pos_x=10,
                pos_y=20,
            ),
        ],
        site=SiteScope.FALCAO,
    )

    ctas = (await service.dashboard(site=SiteScope.FALCAO, days=30)).top_ctas

    assert ctas[0].label == "Quero participar"
    assert ctas[0].count == 2
    assert (ctas[0].pos_x, ctas[0].pos_y) == (50, 50)  # media dos dois cliques


@pytest.mark.asyncio
async def test_dashboard_sem_site_soma_os_canais(session: AsyncSession) -> None:
    service = AnalyticsService(SqlAlchemySiteEventRepository(session))
    await service.record(
        [_event("sessao-000a", SiteEventType.PAGEVIEW)], site=SiteScope.FALCAO
    )
    await service.record(
        [_event("sessao-000b", SiteEventType.PAGEVIEW)], site=SiteScope.FALCAO
    )
    await service.record(
        [_event("sessao-000c", SiteEventType.PAGEVIEW)], site=SiteScope.FALCAO
    )

    assert (await service.dashboard(site=None, days=30)).overview.visitors == 3


@pytest.mark.asyncio
async def test_paginas_mais_vistas_devolve_quebra_real_por_site(
    session: AsyncSession,
) -> None:
    service = AnalyticsService(SqlAlchemySiteEventRepository(session))
    await service.record(
        [
            _event("sessao-casa-1", SiteEventType.PAGEVIEW, page="/cases/acme"),
            _event("sessao-casa-2", SiteEventType.PAGEVIEW, page="/cases/acme"),
        ],
        site=SiteScope.FALCAO,
    )
    await service.record(
        [_event("sessao-case-1", SiteEventType.PAGEVIEW, page="/cases/acme")],
        site=SiteScope.FALCAO,
    )
    await service.record(
        [_event("sessao-empresa-1", SiteEventType.PAGEVIEW, page="/orcamento")],
        site=SiteScope.FALCAO,
    )

    pages = {
        row.label: row
        for row in (await service.dashboard(site=None, days=30)).top_pages
    }

    assert pages["/cases/acme"].count == 3
    assert [(item.site, item.count) for item in pages["/cases/acme"].by_site] == [
        ("falcao", 3),
    ]


@pytest.mark.asyncio
async def test_lista_paginada_de_paginas_nao_esconde_rota_fora_do_top_global(
    session: AsyncSession,
) -> None:
    service = AnalyticsService(SqlAlchemySiteEventRepository(session))
    await service.record(
        [
            _event(
                f"sessao-casa-{index:02}",
                SiteEventType.PAGEVIEW,
                page=f"/blog-{index:02}",
            )
            for index in range(10)
        ],
        site=SiteScope.FALCAO,
    )
    await service.record(
        [
            _event(
                "sessao-case-industria",
                SiteEventType.PAGEVIEW,
                page="/cases/case-limpeza-industrial",
            )
        ],
        site=SiteScope.FALCAO,
    )

    pages = await service.pages(site=None, days=30, page=2, page_size=10)

    assert pages.total == 11
    assert [(item.site, item.path, item.pageviews) for item in pages.items] == [
        ("falcao", "/cases/case-limpeza-industrial", 1)
    ]


@pytest.mark.asyncio
async def test_dashboard_devolve_composicoes_reais_para_tooltips(
    session: AsyncSession,
) -> None:
    service = AnalyticsService(SqlAlchemySiteEventRepository(session))
    await service.record(
        [
            _event(
                "sessao-casa",
                SiteEventType.PAGEVIEW,
                page="/cases/acme",
                referrer="https://www.google.com/search",
                device="desktop",
            ),
            _event(
                "sessao-casa", SiteEventType.CLICK, target="Falar com especialista"
            ),
        ],
        site=SiteScope.FALCAO,
    )
    await service.record(
        [
            _event(
                "sessao-empresa",
                SiteEventType.PAGEVIEW,
                page="/orcamento",
                utm_source="instagram",
                device="mobile",
            ),
            _event(
                "sessao-empresa", SiteEventType.CLICK, target="Falar com especialista"
            ),
        ],
        site=SiteScope.FALCAO,
    )

    dashboard = await service.dashboard(site=None, days=30)
    cta = next(
        row for row in dashboard.top_ctas if row.label == "Falar com especialista"
    )
    sources = {row.label: row for row in dashboard.sources}
    devices = {row.label: row for row in dashboard.devices}
    pageview = next(row for row in dashboard.funnel if row.step == "pageview")
    day = next(point for point in dashboard.timeseries if point.visitors == 2)

    assert [(item.site, item.count) for item in cta.by_site] == [
        ("falcao", 2),
    ]
    assert [(item.site, item.count) for item in sources["Google · Web"].by_site] == [
        ("falcao", 1)
    ]
    assert [(item.site, item.count) for item in devices["Celular"].by_site] == [
        ("falcao", 1)
    ]
    assert [(item.site, item.count) for item in pageview.by_site] == [
        ("falcao", 2),
    ]
    assert [(item.site, item.visitors, item.pageviews) for item in day.by_site] == [
        ("falcao", 2, 2),
    ]


@pytest.mark.asyncio
async def test_origem_usa_utm_e_cai_no_host_do_referrer(session: AsyncSession) -> None:
    service = AnalyticsService(SqlAlchemySiteEventRepository(session))
    await service.record(
        [
            _event("sessao-000a", SiteEventType.PAGEVIEW, utm_source="linkedin"),
            _event(
                "sessao-000b",
                SiteEventType.PAGEVIEW,
                referrer="https://www.google.com/search",
            ),
            _event("sessao-000c", SiteEventType.PAGEVIEW),
        ],
        site=SiteScope.FALCAO,
    )

    origens = {
        row.label: row.count
        for row in (await service.dashboard(site=None, days=30)).sources
    }

    assert origens == {"linkedin / n\u00e3o informado": 1, "Google · Web": 1, "Direto": 1}


@pytest.mark.asyncio
async def test_origens_preservam_utms_e_distinguem_canais_tecnicamente_identificaveis(
    session: AsyncSession,
) -> None:
    service = AnalyticsService(SqlAlchemySiteEventRepository(session))
    await service.record(
        [
            _event(
                "sessao-ig", SiteEventType.PAGEVIEW, utm_source="ig", device="mobile"
            ),
            _event(
                "sessao-instagram-link",
                SiteEventType.PAGEVIEW,
                referrer="https://l.instagram.com/?u=destino",
                device="mobile",
            ),
            _event(
                "sessao-linkedin-android",
                SiteEventType.PAGEVIEW,
                referrer="https://com.linkedin.android/feed",
                device="mobile",
            ),
            _event(
                "sessao-facebook-mobile",
                SiteEventType.PAGEVIEW,
                referrer="https://m.facebook.com/post",
                device="desktop",
            ),
        ],
        site=SiteScope.FALCAO,
    )

    dashboard = await service.dashboard(site=SiteScope.FALCAO, days=30)
    sources = {row.label: row for row in dashboard.sources}
    devices = {row.label: row for row in dashboard.devices}

    # A linha e normalizada para leitura, mas o valor capturado segue disponivel
    # no tooltip para auditoria.
    raw_labels = sources["Instagram / n\u00e3o informado"].raw_labels
    assert [(item.label, item.count) for item in raw_labels] == [
        ("ig", 1)
    ]
    # O host do referrer identifica o redirecionador, mas nao o mistura com a
    # navegacao web do Instagram ou com um eventual app nativo.
    instagram_redirect = sources["Instagram · Redirecionador de link"]
    assert [(item.label, item.count) for item in instagram_redirect.raw_labels] == [
        ("l.instagram.com", 1)
    ]
    assert [
        (item.label, item.count) for item in sources["LinkedIn · Android"].raw_labels
    ] == [("com.linkedin.android", 1)]
    assert "Facebook · Web móvel" in sources
    assert [(item.label, item.count) for item in devices["Celular"].raw_labels] == [
        ("mobile", 3)
    ]
    assert "Computador" in devices


@pytest.mark.asyncio
async def test_origens_exibem_meio_campanha_criativo_e_link_na_primeira_atribuicao(
    session: AsyncSession,
) -> None:
    link = CampaignSourceLink(
        identifier="reel-agosto-01",
        title="Reel Agentes IA",
        source_url="https://www.instagram.com/reel/ABC123/",
        thumbnail_url="https://cdn.example.com/reel-agosto-01.jpg",
        redirect_url="",
    )
    session.add(link)
    await session.commit()

    service = AnalyticsService(
        SqlAlchemySiteEventRepository(session),
        SqlAlchemyCampaignSourceLinkRepository(session),
    )
    first = datetime.now(UTC) - timedelta(minutes=2)
    second = datetime.now(UTC) - timedelta(minutes=1)
    await service.record(
        [
            _event(
                "sessao-campanha-1",
                SiteEventType.PAGEVIEW,
                occurred_at=first,
                utm_source="ig",
                utm_medium="paid",
                utm_campaign="PROMO | Verao | Leads | Teste 01",
                utm_content="reel-agosto-01",
            ),
            # A campanha muda dentro da sessao: a origem continua sendo a
            # primeira atribuicao, sem contar a segunda como nova visita.
            _event(
                "sessao-campanha-1",
                SiteEventType.PAGEVIEW,
                occurred_at=second,
                utm_source="ig",
                utm_medium="paid",
                utm_campaign="outra-campanha",
                utm_content="reel-agosto-02",
            ),
            _event(
                "sessao-campanha-2",
                SiteEventType.PAGEVIEW,
                occurred_at=first,
                utm_source="ig",
                utm_medium="paid",
                utm_campaign="PROMO | Verao | Leads | Teste 01",
                utm_content="reel-agosto-01",
            ),
            _event(
                "sessao-campanha-3",
                SiteEventType.PAGEVIEW,
                occurred_at=first,
                utm_source="ig",
                utm_medium="social",
                utm_campaign="PROMO | Verao | Leads | Teste 01",
                utm_content="reel-agosto-01",
            ),
        ],
        site=SiteScope.FALCAO,
    )

    sources = {
        row.label: row
        for row in (await service.dashboard(site=SiteScope.FALCAO, days=30)).sources
    }

    paid = sources["Instagram / M\u00eddia paga"]
    assert paid.count == 2
    assert [(campaign.label, campaign.count) for campaign in paid.campaigns] == [
        ("promo-verao-leads-teste-01", 2)
    ]
    creative = paid.campaigns[0].creatives[0]
    assert creative.label == "reel-agosto-01"
    assert creative.count == 2
    assert creative.link is not None
    assert creative.link.title == "Reel Agentes IA"
    assert sources["Instagram / Social"].count == 1


@pytest.mark.asyncio
async def test_origens_normalizam_aliases_e_campanhas_codificadas(
    session: AsyncSession,
) -> None:
    now = datetime.now(UTC)
    session.add_all(
        [
            SiteEvent(
                site=SiteScope.FALCAO,
                session_id="sessao-alias-ig",
                event=SiteEventType.PAGEVIEW,
                utm_source="ig",
                utm_medium="paid",
                utm_campaign="PROMO | Verao | Leads | Teste 01",
                created_at=now - timedelta(minutes=3),
                occurred_at=now - timedelta(minutes=3),
            ),
            SiteEvent(
                site=SiteScope.FALCAO,
                session_id="sessao-alias-instagram",
                event=SiteEventType.PAGEVIEW,
                utm_source="instagram",
                utm_medium="cpc",
                utm_campaign="PROMO+%7C+Verao+%7C+Leads+%7C+Teste+01",
                created_at=now - timedelta(minutes=2),
                occurred_at=now - timedelta(minutes=2),
            ),
            SiteEvent(
                site=SiteScope.FALCAO,
                session_id="sessao-alias-an",
                event=SiteEventType.PAGEVIEW,
                utm_source="an",
                utm_medium="paid",
                utm_campaign="120254415164050496",
                created_at=now - timedelta(minutes=1),
                occurred_at=now - timedelta(minutes=1),
            ),
        ]
    )
    await session.commit()

    service = AnalyticsService(SqlAlchemySiteEventRepository(session))
    rows = {
        row.label: row
        for row in (await service.dashboard(site=SiteScope.FALCAO, days=30)).sources
    }

    instagram = rows["Instagram / M\u00eddia paga"]
    assert instagram.count == 2
    assert [(campaign.label, campaign.count) for campaign in instagram.campaigns] == [
        ("PROMO | Verao | Leads | Teste 01", 2)
    ]
    assert {(raw.label, raw.count) for raw in instagram.raw_labels} == {
        ("ig", 1),
        ("instagram", 1),
    }

    audience_network = rows["Audience Network / M\u00eddia paga"]
    assert [campaign.label for campaign in audience_network.campaigns] == [
        "ID da campanha \u00b7 120254415164050496"
    ]


@pytest.mark.asyncio
async def test_janela_de_dias_ignora_evento_antigo(session: AsyncSession) -> None:
    repository = SqlAlchemySiteEventRepository(session)
    service = AnalyticsService(repository)
    await service.record(
        [_event("sessao-nova", SiteEventType.PAGEVIEW)], site=SiteScope.FALCAO
    )
    # Fora da janela de 7 dias pedida no dashboard.
    session.add(
        SiteEvent(
            site=SiteScope.FALCAO,
            session_id="sessao-velha",
            event=SiteEventType.PAGEVIEW,
            created_at=datetime.now(UTC) - timedelta(days=40),
        )
    )
    await session.commit()

    assert (await service.dashboard(site=None, days=7)).overview.visitors == 1
    assert (await service.dashboard(site=None, days=60)).overview.visitors == 2


@pytest.mark.asyncio
async def test_dashboard_de_intervalo_preenche_dias_vazios_e_compara_periodo_anterior(
    session: AsyncSession,
) -> None:
    repository = SqlAlchemySiteEventRepository(session)
    start_at = datetime(2026, 8, 1, tzinfo=UTC)
    end_at = datetime(2026, 8, 4, tzinfo=UTC)
    await repository.add_many(
        [
            SiteEvent(
                site=SiteScope.FALCAO,
                session_id="sessao-dia-um",
                event=SiteEventType.PAGEVIEW,
                created_at=start_at,
            ),
            SiteEvent(
                site=SiteScope.FALCAO,
                session_id="sessao-dia-tres",
                event=SiteEventType.PAGEVIEW,
                created_at=start_at + timedelta(days=2),
            ),
        ]
    )

    dashboard = await AnalyticsService(repository).dashboard(
        site=SiteScope.FALCAO,
        start_at=start_at,
        end_at=end_at,
    )

    assert [point.visitors for point in dashboard.timeseries] == [1, 0, 1]
    assert len(dashboard.comparison_timeseries) == 3
    assert dashboard.pages_per_session == 1.0
    assert dashboard.period.start == start_at.date()
    assert dashboard.period.end == (end_at - timedelta(days=1)).date()


@pytest.mark.asyncio
async def test_purge_remove_so_o_que_esta_fora_da_retencao(
    session: AsyncSession,
) -> None:
    repository = SqlAlchemySiteEventRepository(session)
    await AnalyticsService(repository).record(
        [_event("sessao-nova", SiteEventType.PAGEVIEW)], site=SiteScope.FALCAO
    )
    session.add(
        SiteEvent(
            site=SiteScope.FALCAO,
            session_id="sessao-velha",
            event=SiteEventType.PAGEVIEW,
            created_at=datetime.now(UTC) - timedelta(days=400),
        )
    )
    await session.commit()

    assert await repository.purge_older_than(360) == 1
    assert (
        await AnalyticsService(repository).dashboard(site=None, days=365)
    ).overview.visitors == 1


@pytest.mark.asyncio
async def test_journey_repository_limits_timeline_to_marker_and_its_session(
    session: AsyncSession,
) -> None:
    repository = SqlAlchemySiteEventRepository(session)
    marker_at = datetime(2026, 8, 18, 12, 0, tzinfo=UTC)
    contact_id = "contact-1"
    marker = SiteEvent(
        site=SiteScope.FALCAO,
        session_id="sessao-ana",
        event=SiteEventType.FORM_SUBMIT,
        target=lead_submission_target(contact_id, "reel-01"),
        created_at=marker_at,
    )
    await repository.add_many(
        [
            SiteEvent(
                site=SiteScope.FALCAO,
                session_id="sessao-ana",
                event=SiteEventType.PAGEVIEW,
                created_at=marker_at - timedelta(minutes=2),
            ),
            marker,
            SiteEvent(
                site=SiteScope.FALCAO,
                session_id="sessao-ana",
                event=SiteEventType.CLICK,
                created_at=marker_at + timedelta(minutes=1),
            ),
            SiteEvent(
                site=SiteScope.FALCAO,
                session_id="sessao-outra",
                event=SiteEventType.PAGEVIEW,
                created_at=marker_at - timedelta(minutes=1),
            ),
        ]
    )

    found = await repository.find_lead_marker(
        contact_id=contact_id,
        site=SiteScope.FALCAO,
        submitted_at=marker_at + timedelta(minutes=1),
    )
    assert found is not None
    events, truncated = await repository.events_for_session_until(
        session_id=found.session_id,
        site=SiteScope.FALCAO,
        marker_at=found.created_at,
    )

    assert [event.event for event in events] == [
        SiteEventType.PAGEVIEW,
        SiteEventType.FORM_SUBMIT,
    ]
    assert truncated is False


@pytest.mark.asyncio
async def test_journey_repository_orders_by_occurrence_not_batch_receipt(
    session: AsyncSession,
) -> None:
    repository = SqlAlchemySiteEventRepository(session)
    marker_at = datetime(2026, 8, 18, 12, 0, tzinfo=UTC)
    marker = SiteEvent(
        site=SiteScope.FALCAO,
        session_id="sessao-ordenada",
        event=SiteEventType.FORM_SUBMIT,
        target=lead_submission_target("contact-ordenado", "reel-01"),
        occurred_at=marker_at,
        created_at=marker_at,
    )
    await repository.add_many(
        [
            SiteEvent(
                site=SiteScope.FALCAO,
                session_id="sessao-ordenada",
                event=SiteEventType.PAGEVIEW,
                occurred_at=marker_at - timedelta(minutes=2),
                created_at=marker_at - timedelta(minutes=1),
            ),
            SiteEvent(
                site=SiteScope.FALCAO,
                session_id="sessao-ordenada",
                event=SiteEventType.CLICK,
                occurred_at=marker_at - timedelta(minutes=1),
                created_at=marker_at - timedelta(minutes=2),
            ),
            marker,
        ]
    )

    events, _ = await repository.events_for_session_until(
        session_id="sessao-ordenada",
        site=SiteScope.FALCAO,
        marker_at=marker_at,
    )

    assert [event.event for event in events] == [
        SiteEventType.PAGEVIEW,
        SiteEventType.CLICK,
        SiteEventType.FORM_SUBMIT,
    ]


@pytest.mark.asyncio
async def test_journey_repository_limita_eventos_da_sessao(
    session: AsyncSession,
) -> None:
    repository = SqlAlchemySiteEventRepository(session)
    marker_at = datetime(2026, 8, 18, 12, 0, tzinfo=UTC)
    marker = SiteEvent(
        site=SiteScope.FALCAO,
        session_id="sessao-grande",
        event=SiteEventType.FORM_SUBMIT,
        target=lead_submission_target("contact-grande", "reel-01"),
        created_at=marker_at,
    )
    preceding_events = [
        SiteEvent(
            site=SiteScope.FALCAO,
            session_id="sessao-grande",
            event=SiteEventType.CLICK,
            target=str(index),
            created_at=marker_at - timedelta(seconds=index + 1),
        )
        for index in range(200)
    ]
    await repository.add_many([*preceding_events, marker])

    events, truncated = await repository.events_for_session_until(
        session_id="sessao-grande",
        site=SiteScope.FALCAO,
        marker_at=marker_at,
    )

    assert len(events) == 200
    assert truncated is True
    assert events[-1].id == marker.id


@pytest.mark.asyncio
async def test_dashboard_combina_rollups_diarios_de_eventos_purgados(
    session: AsyncSession,
) -> None:
    repository = SqlAlchemySiteEventRepository(session)
    service = AnalyticsService(repository)
    expired_at = datetime.now(UTC) - timedelta(days=100)

    # Cria evento antigo e arquiva para rollup
    session.add_all(
        [
            SiteEvent(
                site=SiteScope.FALCAO,
                session_id="sessao-antiga",
                event=SiteEventType.PAGEVIEW,
                page="/solucoes",
                created_at=expired_at,
            ),
            SiteEvent(
                site=SiteScope.FALCAO,
                session_id="sessao-recente",
                event=SiteEventType.PAGEVIEW,
                page="/cases",
                created_at=datetime.now(UTC),
            ),
        ]
    )
    await session.commit()

    # Purga eventos > 90 dias gerando DailyAnalyticsRollup
    await repository.archive_and_purge_older_than(90)

    dashboard = await service.dashboard(site=SiteScope.FALCAO, days=120)

    # Ambos os dias (recente do evento bruto + antigo do rollup) são computados
    assert dashboard.overview.visitors == 2
    assert dashboard.overview.pageviews == 2
