from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.promocao import Promocao

TZ_SP = ZoneInfo("America/Sao_Paulo")


class PromocaoRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_by_id(self, promo_id: str) -> Promocao | None:
        return await self.session.get(Promocao, promo_id)

    async def list_active(
        self, publico: str | None = None, agora: datetime | None = None
    ) -> list[Promocao]:
        if agora is None:
            agora = datetime.now(TZ_SP)

        query = select(Promocao).where(
            Promocao.is_active.is_(True),
            Promocao.data_inicio <= agora,
            Promocao.data_fim >= agora,
        )

        if publico and publico != "todos":
            query = query.where(
                or_(
                    Promocao.publico == "todos",
                    Promocao.publico == publico,
                )
            )

        # Ordenação para desempate (CA-13): maior prioridade, data_inicio mais recente, id
        query = query.order_by(
            Promocao.prioridade.desc(),
            Promocao.data_inicio.desc(),
            Promocao.id.asc(),
        )

        result = await self.session.scalars(query)
        return list(result.all())

    async def list_all(self) -> list[Promocao]:
        query = select(Promocao).order_by(
            Promocao.prioridade.desc(),
            Promocao.data_inicio.desc(),
        )
        result = await self.session.scalars(query)
        return list(result.all())

    async def create(self, promocao: Promocao) -> Promocao:
        self.session.add(promocao)
        await self.session.flush()
        return promocao

    async def delete(self, promocao: Promocao) -> None:
        await self.session.delete(promocao)
        await self.session.flush()

    async def record_metric(self, promo_id: str, metric_type: str) -> None:
        promo = await self.get_by_id(promo_id)
        if not promo:
            return
        if metric_type == "view":
            promo.views_count += 1
        elif metric_type == "click":
            promo.clicks_count += 1
        await self.session.flush()
