# ponytail: SQLite so aguenta um escritor; escalar out = mover pro aura
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.site import SiteScope
from app.domain.entities.testimonial import Testimonial


class SqlAlchemyTestimonialRepository:
    """Persistencia local dos depoimentos.

    Sem ABC de dominio e sem variante aura de proposito: a tabela e local e tem
    uma implementacao so (mesmo caminho de `campaign_source_links`).
    """

    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_by_site(
        self, site: SiteScope | str, only_active: bool = False
    ) -> list[Testimonial]:
        query = select(Testimonial).where(Testimonial.site == site)
        if only_active:
            query = query.where(Testimonial.is_active.is_(True))
        query = query.order_by(Testimonial.sort_order, Testimonial.created_at)
        result = await self.session.execute(query)
        return list(result.scalars())

    async def find_by_id(self, testimonial_id: str) -> Testimonial | None:
        return await self.session.get(Testimonial, testimonial_id)

    async def save(self, testimonial: Testimonial) -> Testimonial:
        self.session.add(testimonial)
        try:
            await self.session.commit()
            await self.session.refresh(testimonial)
            return testimonial
        except Exception:
            await self.session.rollback()
            raise

    async def delete(self, testimonial_id: str) -> bool:
        testimonial = await self.find_by_id(testimonial_id)
        if testimonial is None:
            return False
        try:
            await self.session.delete(testimonial)
            await self.session.commit()
            return True
        except Exception:
            await self.session.rollback()
            raise

    async def reorder(self, site: SiteScope | str, ids: list[str]) -> bool:
        """Reatribui sort_order 0..n numa transacao. False = lista invalida.

        Valida antes de gravar: um id de outro site (ou inexistente) aborta tudo,
        senao a tela deixaria a ordem pela metade.
        """
        current = await self.list_by_site(site)
        known = {item.id: item for item in current}
        if len(ids) != len(known) or set(ids) != set(known):
            return False

        try:
            for position, item_id in enumerate(ids):
                known[item_id].sort_order = position
            await self.session.commit()
            return True
        except Exception:
            await self.session.rollback()
            raise
