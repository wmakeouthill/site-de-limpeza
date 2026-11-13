from typing import Any

from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.domain.entities.catalog import Departamento, Kit, KitItem, Produto


class SqlAlchemyCatalogRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    # ==========================================================================
    # DEPARTAMENTOS
    # ==========================================================================

    async def list_departamentos(self, only_active: bool = False) -> list[Departamento]:
        query = select(Departamento)
        if only_active:
            query = query.where(Departamento.is_active.is_(True))
        query = query.order_by(Departamento.ordem, Departamento.nome)
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_departamento_by_id(self, departamento_id: str) -> Departamento | None:
        return await self.session.get(Departamento, departamento_id)

    async def get_departamento_by_slug(self, slug: str) -> Departamento | None:
        query = select(Departamento).where(Departamento.slug == slug)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def count_produtos_by_departamento(
        self, departamento_id: str, only_active: bool = False
    ) -> int:
        query = select(func.count(Produto.id)).where(Produto.departamento_id == departamento_id)
        if only_active:
            query = query.where(Produto.is_active.is_(True))
        result = await self.session.execute(query)
        return result.scalar_one() or 0

    async def save_departamento(self, departamento: Departamento) -> Departamento:
        self.session.add(departamento)
        try:
            await self.session.commit()
            await self.session.refresh(departamento)
            return departamento
        except Exception:
            await self.session.rollback()
            raise

    async def delete_departamento(self, departamento_id: str) -> bool:
        dept = await self.get_departamento_by_id(departamento_id)
        if dept is None:
            return False
        try:
            await self.session.delete(dept)
            await self.session.commit()
            return True
        except Exception:
            await self.session.rollback()
            raise

    # ==========================================================================
    # PRODUTOS
    # ==========================================================================

    async def list_produtos(
        self,
        departamento_id: str | None = None,
        departamento_slug: str | None = None,
        q: str | None = None,
        only_active: bool = False,
        apenas_ofertas: bool = False,
        apenas_embalagem_grande: bool = False,
        marca: str | None = None,
        ordem: str | None = None,
    ) -> list[Produto]:
        query = select(Produto).options(selectinload(Produto.departamento))

        if only_active:
            query = query.where(Produto.is_active.is_(True))

        if departamento_id:
            query = query.where(Produto.departamento_id == departamento_id)
        elif departamento_slug:
            query = query.join(Produto.departamento).where(Departamento.slug == departamento_slug)

        if apenas_embalagem_grande:
            query = query.where(Produto.embalagem_grande.is_(True))

        if marca:
            query = query.where(func.lower(Produto.marca) == marca.lower())

        if apenas_ofertas:
            query = query.where(
                Produto.preco_por.is_not(None),
                Produto.preco_por < Produto.preco_de,
            )

        if q:
            termo = f"%{q.strip().lower()}%"
            query = query.where(
                or_(
                    func.lower(Produto.nome).like(termo),
                    func.lower(Produto.marca).like(termo),
                    func.lower(Produto.descricao).like(termo),
                )
            )

        if ordem == "preco_asc":
            query = query.order_by(Produto.preco_de.asc(), Produto.ordem.asc())
        elif ordem == "preco_desc":
            query = query.order_by(Produto.preco_de.desc(), Produto.ordem.asc())
        elif ordem == "nome_asc":
            query = query.order_by(Produto.nome.asc())
        else:
            query = query.order_by(Produto.ordem.asc(), Produto.nome.asc())

        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_produto_by_id(self, produto_id: str) -> Produto | None:
        query = select(Produto).options(selectinload(Produto.departamento)).where(Produto.id == produto_id)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_produto_by_slug(self, slug: str) -> Produto | None:
        query = select(Produto).options(selectinload(Produto.departamento)).where(Produto.slug == slug)
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def save_produto(self, produto: Produto) -> Produto:
        self.session.add(produto)
        try:
            await self.session.commit()
            await self.session.refresh(produto)
            return produto
        except Exception:
            await self.session.rollback()
            raise

    async def check_produto_in_use(self, produto_id: str) -> tuple[bool, str]:
        """Verifica se o produto está vinculado a kits ou guias."""
        # 1. Checa kit_itens
        query_kit = select(func.count(KitItem.id)).where(KitItem.produto_id == produto_id)
        res_kit = await self.session.execute(query_kit)
        total_kits = res_kit.scalar_one() or 0
        if total_kits > 0:
            return True, f"Produto associado a {total_kits} kit(s) no catálogo."

        return False, ""

    async def delete_produto(self, produto_id: str) -> bool:
        prod = await self.get_produto_by_id(produto_id)
        if prod is None:
            return False
        try:
            await self.session.delete(prod)
            await self.session.commit()
            return True
        except Exception:
            await self.session.rollback()
            raise

    # ==========================================================================
    # KITS
    # ==========================================================================

    async def list_kits(
        self, publico: str | None = None, only_active: bool = False
    ) -> list[Kit]:
        query = (
            select(Kit)
            .options(
                selectinload(Kit.itens).selectinload(KitItem.produto).selectinload(Produto.departamento)
            )
        )
        if only_active:
            query = query.where(Kit.is_active.is_(True))
        if publico:
            query = query.where(Kit.publico == publico)
        query = query.order_by(Kit.ordem.asc(), Kit.nome.asc())
        result = await self.session.execute(query)
        return list(result.scalars().all())

    async def get_kit_by_id(self, kit_id: str) -> Kit | None:
        query = (
            select(Kit)
            .options(
                selectinload(Kit.itens).selectinload(KitItem.produto).selectinload(Produto.departamento)
            )
            .where(Kit.id == kit_id)
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def get_kit_by_slug(self, slug: str) -> Kit | None:
        query = (
            select(Kit)
            .options(
                selectinload(Kit.itens).selectinload(KitItem.produto).selectinload(Produto.departamento)
            )
            .where(Kit.slug == slug)
        )
        result = await self.session.execute(query)
        return result.scalar_one_or_none()

    async def save_kit(self, kit: Kit, itens_data: list[dict[str, Any]] | None = None) -> Kit:
        self.session.add(kit)
        try:
            await self.session.flush()

            if itens_data is not None:
                # Remove itens existentes e recria
                await self.session.execute(delete(KitItem).where(KitItem.kit_id == kit.id))
                for item_dict in itens_data:
                    item = KitItem(
                        kit_id=kit.id,
                        produto_id=item_dict["produto_id"],
                        quantidade=item_dict.get("quantidade", 1),
                        ordem=item_dict.get("ordem", 0),
                    )
                    self.session.add(item)

            await self.session.commit()
            return await self.get_kit_by_id(kit.id) or kit
        except Exception:
            await self.session.rollback()
            raise

    async def delete_kit(self, kit_id: str) -> bool:
        kit = await self.get_kit_by_id(kit_id)
        if kit is None:
            return False
        try:
            await self.session.delete(kit)
            await self.session.commit()
            return True
        except Exception:
            await self.session.rollback()
            raise
