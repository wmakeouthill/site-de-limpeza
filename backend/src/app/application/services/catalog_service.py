from datetime import date

from app.domain.entities.catalog import Departamento, Kit, Produto
from app.domain.exceptions.catalog import (
    DepartmentNotFoundError,
    DuplicateSlugError,
    KitNotFoundError,
    ProductInUseConflictError,
    ProductNotFoundError,
)
from app.domain.schemas.catalog import (
    CmsDepartamentoResponse,
    CmsKitResponse,
    CmsProdutoResponse,
    DepartamentoCreate,
    DepartamentoUpdate,
    KitCreate,
    KitItemResponse,
    ProdutoCreate,
    ProdutoUpdate,
    PublicDepartamentoResponse,
    PublicKitResponse,
    PublicProdutoResponse,
    _validar_regras_oferta,
    calcular_oferta,
    slugify,
)
from app.infrastructure.repositories.catalog_repository import SqlAlchemyCatalogRepository


class CatalogService:
    def __init__(self, repository: SqlAlchemyCatalogRepository) -> None:
        self.repository = repository

    # ==========================================================================
    # MAPEADORES
    # ==========================================================================

    @staticmethod
    def to_public_produto(produto: Produto, hoje: date | None = None) -> PublicProdutoResponse:
        promo_ativa, desconto_pct, preco_atual = calcular_oferta(
            preco_de=produto.preco_de,
            preco_por=produto.preco_por,
            promo_inicio=produto.promo_inicio,
            promo_fim=produto.promo_fim,
            hoje=hoje,
        )

        return PublicProdutoResponse(
            id=produto.id,
            departamento_id=produto.departamento_id,
            departamento_nome=produto.departamento.nome if produto.departamento else None,
            departamento_slug=produto.departamento.slug if produto.departamento else None,
            nome=produto.nome,
            slug=produto.slug,
            marca=produto.marca or "",
            tamanho=produto.tamanho or "",
            descricao=produto.descricao or "",
            como_usar=produto.como_usar or "",
            forma=produto.forma or "garrafa",
            cor=produto.cor or "#003399",
            imagem_url=produto.imagem_url,
            imagem_posicao=produto.imagem_posicao or "center",
            imagem_zoom=produto.imagem_zoom if produto.imagem_zoom is not None else 100,
            preco_de=f"{produto.preco_de:.2f}",
            preco_por=f"{produto.preco_por:.2f}" if (promo_ativa and produto.preco_por) else None,
            promo_ativa=promo_ativa,
            desconto_pct=desconto_pct,
            promo_inicio=produto.promo_inicio.isoformat() if (promo_ativa and produto.promo_inicio) else None,
            promo_fim=produto.promo_fim.isoformat() if (promo_ativa and produto.promo_fim) else None,
            preco_atual=f"{preco_atual:.2f}",
            embalagem_grande=bool(produto.embalagem_grande),
            ordem=produto.ordem or 0,
        )

    @staticmethod
    def to_cms_produto(produto: Produto, hoje: date | None = None) -> CmsProdutoResponse:
        promo_ativa, desconto_pct, preco_atual = calcular_oferta(
            preco_de=produto.preco_de,
            preco_por=produto.preco_por,
            promo_inicio=produto.promo_inicio,
            promo_fim=produto.promo_fim,
            hoje=hoje,
        )

        return CmsProdutoResponse(
            id=produto.id,
            departamento_id=produto.departamento_id,
            departamento_nome=produto.departamento.nome if produto.departamento else None,
            departamento_slug=produto.departamento.slug if produto.departamento else None,
            nome=produto.nome,
            slug=produto.slug,
            marca=produto.marca or "",
            tamanho=produto.tamanho or "",
            descricao=produto.descricao or "",
            como_usar=produto.como_usar or "",
            forma=produto.forma or "garrafa",
            cor=produto.cor or "#003399",
            imagem_url=produto.imagem_url,
            imagem_posicao=produto.imagem_posicao or "center",
            imagem_zoom=produto.imagem_zoom if produto.imagem_zoom is not None else 100,
            preco_de=f"{produto.preco_de:.2f}",
            preco_por=f"{produto.preco_por:.2f}" if produto.preco_por else None,
            promo_inicio=produto.promo_inicio.isoformat() if produto.promo_inicio else None,
            promo_fim=produto.promo_fim.isoformat() if produto.promo_fim else None,
            promo_ativa=promo_ativa,
            desconto_pct=desconto_pct,
            preco_atual=f"{preco_atual:.2f}",
            embalagem_grande=bool(produto.embalagem_grande),
            ordem=produto.ordem or 0,
            is_active=bool(produto.is_active),
            created_at=produto.created_at,
            updated_at=produto.updated_at,
        )

    # ==========================================================================
    # DEPARTAMENTOS
    # ==========================================================================

    async def list_public_departamentos(self) -> list[PublicDepartamentoResponse]:
        departamentos = await self.repository.list_departamentos(only_active=True)
        return [PublicDepartamentoResponse.model_validate(dept) for dept in departamentos]

    async def list_cms_departamentos(self) -> list[CmsDepartamentoResponse]:
        departamentos = await self.repository.list_departamentos(only_active=False)
        result: list[CmsDepartamentoResponse] = []
        for dept in departamentos:
            total = await self.repository.count_produtos_by_departamento(dept.id, only_active=False)
            resp = CmsDepartamentoResponse(
                id=dept.id,
                nome=dept.nome,
                slug=dept.slug,
                descricao=dept.descricao,
                icone=dept.icone,
                uso=dept.uso,
                cuidado=dept.cuidado,
                ordem=dept.ordem,
                is_active=dept.is_active,
                total_produtos=total,
                created_at=dept.created_at,
                updated_at=dept.updated_at,
            )
            result.append(resp)
        return result

    async def get_departamento_by_id(self, departamento_id: str) -> Departamento:
        dept = await self.repository.get_departamento_by_id(departamento_id)
        if dept is None:
            raise DepartmentNotFoundError(f"Departamento {departamento_id} não encontrado.")
        return dept

    async def create_departamento(
        self, data: DepartamentoCreate, user_email: str = ""
    ) -> CmsDepartamentoResponse:
        existing = await self.repository.get_departamento_by_slug(data.slug or slugify(data.nome))
        if existing:
            raise DuplicateSlugError(f"Slug '{data.slug}' já está em uso por outro departamento.")

        dept = Departamento(
            nome=data.nome,
            slug=data.slug or slugify(data.nome),
            descricao=data.descricao or "",
            icone=data.icone,
            uso=data.uso or "",
            cuidado=data.cuidado or "",
            ordem=data.ordem,
            is_active=data.is_active,
            created_by=user_email,
            updated_by=user_email,
        )
        saved = await self.repository.save_departamento(dept)
        return CmsDepartamentoResponse(
            id=saved.id,
            nome=saved.nome,
            slug=saved.slug,
            descricao=saved.descricao,
            icone=saved.icone,
            uso=saved.uso,
            cuidado=saved.cuidado,
            ordem=saved.ordem,
            is_active=saved.is_active,
            total_produtos=0,
            created_at=saved.created_at,
            updated_at=saved.updated_at,
        )

    async def update_departamento(
        self, departamento_id: str, data: DepartamentoUpdate, user_email: str = ""
    ) -> CmsDepartamentoResponse:
        dept = await self.get_departamento_by_id(departamento_id)

        if data.slug and data.slug != dept.slug:
            existing = await self.repository.get_departamento_by_slug(data.slug)
            if existing and existing.id != dept.id:
                raise DuplicateSlugError(f"Slug '{data.slug}' já está em uso.")
            dept.slug = data.slug

        if data.nome is not None:
            dept.nome = data.nome
        if data.descricao is not None:
            dept.descricao = data.descricao
        if data.icone is not None:
            dept.icone = data.icone
        if data.uso is not None:
            dept.uso = data.uso
        if data.cuidado is not None:
            dept.cuidado = data.cuidado
        if data.ordem is not None:
            dept.ordem = data.ordem
        if data.is_active is not None:
            dept.is_active = data.is_active

        dept.updated_by = user_email
        saved = await self.repository.save_departamento(dept)
        total = await self.repository.count_produtos_by_departamento(saved.id, only_active=False)

        return CmsDepartamentoResponse(
            id=saved.id,
            nome=saved.nome,
            slug=saved.slug,
            descricao=saved.descricao,
            icone=saved.icone,
            uso=saved.uso,
            cuidado=saved.cuidado,
            ordem=saved.ordem,
            is_active=saved.is_active,
            total_produtos=total,
            created_at=saved.created_at,
            updated_at=saved.updated_at,
        )

    async def delete_departamento(self, departamento_id: str) -> None:
        total = await self.repository.count_produtos_by_departamento(departamento_id, only_active=False)
        if total > 0:
            raise ProductInUseConflictError(
                f"Departamento contém {total} produto(s). Mova ou remova os produtos antes de excluir."
            )
        deleted = await self.repository.delete_departamento(departamento_id)
        if not deleted:
            raise DepartmentNotFoundError(f"Departamento {departamento_id} não encontrado.")

    # ==========================================================================
    # PRODUTOS
    # ==========================================================================

    async def list_public_produtos(
        self,
        departamento_slug: str | None = None,
        q: str | None = None,
        apenas_ofertas: bool = False,
        apenas_embalagem_grande: bool = False,
        marca: str | None = None,
        ordem: str | None = None,
        hoje: date | None = None,
    ) -> list[PublicProdutoResponse]:
        produtos = await self.repository.list_produtos(
            departamento_slug=departamento_slug,
            q=q,
            only_active=True,
            apenas_ofertas=apenas_ofertas,
            apenas_embalagem_grande=apenas_embalagem_grande,
            marca=marca,
            ordem=ordem,
        )

        respostas = [self.to_public_produto(p, hoje=hoje) for p in produtos]

        if apenas_ofertas:
            # Filtra garantindo que no calendário de hoje a oferta está realmente ativa (CA-03, CA-04)
            respostas = [r for r in respostas if r.promo_ativa]

        return respostas

    async def list_cms_produtos(
        self,
        departamento_id: str | None = None,
        q: str | None = None,
        apenas_ofertas: bool = False,
        apenas_embalagem_grande: bool = False,
        marca: str | None = None,
        ordem: str | None = None,
        hoje: date | None = None,
    ) -> list[CmsProdutoResponse]:
        produtos = await self.repository.list_produtos(
            departamento_id=departamento_id,
            q=q,
            only_active=False,
            apenas_ofertas=apenas_ofertas,
            apenas_embalagem_grande=apenas_embalagem_grande,
            marca=marca,
            ordem=ordem,
        )
        return [self.to_cms_produto(p, hoje=hoje) for p in produtos]

    async def get_public_produto_by_slug(
        self, slug: str, hoje: date | None = None
    ) -> PublicProdutoResponse:
        produto = await self.repository.get_produto_by_slug(slug)
        if produto is None or not produto.is_active:
            raise ProductNotFoundError(f"Produto '{slug}' não encontrado ou inativo.")
        return self.to_public_produto(produto, hoje=hoje)

    async def get_cms_produto_by_id(
        self, produto_id: str, hoje: date | None = None
    ) -> CmsProdutoResponse:
        produto = await self.repository.get_produto_by_id(produto_id)
        if produto is None:
            raise ProductNotFoundError(f"Produto {produto_id} não encontrado.")
        return self.to_cms_produto(produto, hoje=hoje)

    async def create_produto(
        self, data: ProdutoCreate, user_email: str = ""
    ) -> CmsProdutoResponse:
        # Valida departamento
        await self.get_departamento_by_id(data.departamento_id)

        # Valida slug
        slug = data.slug or slugify(f"{data.nome} {data.tamanho}".strip())
        existing = await self.repository.get_produto_by_slug(slug)
        if existing:
            raise DuplicateSlugError(f"Slug '{slug}' já está em uso por outro produto.")

        produto = Produto(
            departamento_id=data.departamento_id,
            nome=data.nome,
            slug=slug,
            marca=data.marca,
            tamanho=data.tamanho,
            descricao=data.descricao,
            como_usar=data.como_usar,
            forma=data.forma,
            cor=data.cor,
            imagem_url=data.imagem_url,
            imagem_posicao=data.imagem_posicao,
            imagem_zoom=data.imagem_zoom,
            preco_de=data.preco_de,
            preco_por=data.preco_por,
            promo_inicio=data.promo_inicio,
            promo_fim=data.promo_fim,
            embalagem_grande=data.embalagem_grande,
            ordem=data.ordem,
            is_active=data.is_active,
            created_by=user_email,
            updated_by=user_email,
        )
        saved = await self.repository.save_produto(produto)
        reloaded = await self.repository.get_produto_by_id(saved.id)
        return self.to_cms_produto(reloaded or saved)

    async def update_produto(
        self, produto_id: str, data: ProdutoUpdate, user_email: str = ""
    ) -> CmsProdutoResponse:
        produto = await self.repository.get_produto_by_id(produto_id)
        if produto is None:
            raise ProductNotFoundError(f"Produto {produto_id} não encontrado.")

        if data.departamento_id is not None:
            await self.get_departamento_by_id(data.departamento_id)
            produto.departamento_id = data.departamento_id

        if data.slug is not None and data.slug != produto.slug:
            existing = await self.repository.get_produto_by_slug(data.slug)
            if existing and existing.id != produto.id:
                raise DuplicateSlugError(f"Slug '{data.slug}' já está em uso.")
            produto.slug = data.slug

        # Determina novos preços para validação de oferta
        novo_preco_de = data.preco_de if data.preco_de is not None else produto.preco_de
        novo_preco_por = data.preco_por if data.preco_por is not None else produto.preco_por
        novo_inicio = data.promo_inicio if data.promo_inicio is not None else produto.promo_inicio
        novo_fim = data.promo_fim if data.promo_fim is not None else produto.promo_fim

        _validar_regras_oferta(novo_preco_de, novo_preco_por, novo_inicio, novo_fim)

        if data.nome is not None:
            produto.nome = data.nome
        if data.marca is not None:
            produto.marca = data.marca
        if data.tamanho is not None:
            produto.tamanho = data.tamanho
        if data.descricao is not None:
            produto.descricao = data.descricao
        if data.como_usar is not None:
            produto.como_usar = data.como_usar
        if data.forma is not None:
            produto.forma = data.forma
        if data.cor is not None:
            produto.cor = data.cor
        if "imagem_url" in data.model_fields_set:  # null remove a foto
            produto.imagem_url = data.imagem_url or None
        if data.imagem_posicao is not None:
            produto.imagem_posicao = data.imagem_posicao
        if data.imagem_zoom is not None:
            produto.imagem_zoom = data.imagem_zoom
        if data.preco_de is not None:
            produto.preco_de = data.preco_de

        produto.preco_por = data.preco_por if "preco_por" in data.model_fields_set else produto.preco_por
        produto.promo_inicio = data.promo_inicio if "promo_inicio" in data.model_fields_set else produto.promo_inicio
        produto.promo_fim = data.promo_fim if "promo_fim" in data.model_fields_set else produto.promo_fim

        if data.embalagem_grande is not None:
            produto.embalagem_grande = data.embalagem_grande
        if data.ordem is not None:
            produto.ordem = data.ordem
        if data.is_active is not None:
            produto.is_active = data.is_active

        produto.updated_by = user_email
        saved = await self.repository.save_produto(produto)
        reloaded = await self.repository.get_produto_by_id(saved.id)
        return self.to_cms_produto(reloaded or saved)

    async def delete_produto(self, produto_id: str) -> None:
        in_use, motivo = await self.repository.check_produto_in_use(produto_id)
        if in_use:
            raise ProductInUseConflictError(
                f"Não é possível excluir o produto: {motivo}. Sugestão: desative o produto em vez de excluí-lo."
            )
        deleted = await self.repository.delete_produto(produto_id)
        if not deleted:
            raise ProductNotFoundError(f"Produto {produto_id} não encontrado.")

    # ==========================================================================
    # KITS
    # ==========================================================================

    async def list_public_kits(self, publico: str | None = None, hoje: date | None = None) -> list[PublicKitResponse]:
        kits = await self.repository.list_kits(publico=publico, only_active=True)
        respostas: list[PublicKitResponse] = []
        for kit in kits:
            itens_resp: list[KitItemResponse] = []
            for item in kit.itens:
                if item.produto and item.produto.is_active:
                    itens_resp.append(
                        KitItemResponse(
                            id=item.id,
                            produto_id=item.produto_id,
                            produto=self.to_public_produto(item.produto, hoje=hoje),
                            quantidade=item.quantidade,
                            ordem=item.ordem,
                        )
                    )
            respostas.append(
                PublicKitResponse(
                    id=kit.id,
                    nome=kit.nome,
                    slug=kit.slug,
                    descricao=kit.descricao,
                    publico=kit.publico,
                    ordem=kit.ordem,
                    itens=itens_resp,
                )
            )
        return respostas

    async def list_cms_kits(self, publico: str | None = None, hoje: date | None = None) -> list[CmsKitResponse]:
        kits = await self.repository.list_kits(publico=publico, only_active=False)
        respostas: list[CmsKitResponse] = []
        for kit in kits:
            itens_resp: list[KitItemResponse] = []
            for item in kit.itens:
                itens_resp.append(
                    KitItemResponse(
                        id=item.id,
                        produto_id=item.produto_id,
                        produto=self.to_public_produto(item.produto, hoje=hoje) if item.produto else None,
                        quantidade=item.quantidade,
                        ordem=item.ordem,
                    )
                )
            respostas.append(
                CmsKitResponse(
                    id=kit.id,
                    nome=kit.nome,
                    slug=kit.slug,
                    descricao=kit.descricao,
                    publico=kit.publico,
                    ordem=kit.ordem,
                    itens=itens_resp,
                    is_active=kit.is_active,
                    created_at=kit.created_at,
                    updated_at=kit.updated_at,
                )
            )
        return respostas

    async def create_kit(self, data: KitCreate, user_email: str = "") -> CmsKitResponse:
        slug = data.slug or slugify(data.nome)
        existing = await self.repository.get_kit_by_slug(slug)
        if existing:
            raise DuplicateSlugError(f"Slug '{slug}' já está em uso por outro kit.")

        # Valida que todos os produtos existem
        for item in data.itens:
            prod = await self.repository.get_produto_by_id(item.produto_id)
            if prod is None:
                raise ProductNotFoundError(f"Produto {item.produto_id} não encontrado para o kit.")

        kit = Kit(
            nome=data.nome,
            slug=slug,
            descricao=data.descricao,
            publico=data.publico,
            ordem=data.ordem,
            is_active=data.is_active,
            created_by=user_email,
            updated_by=user_email,
        )
        itens_data = [item.model_dump() for item in data.itens]
        saved = await self.repository.save_kit(kit, itens_data=itens_data)
        return (await self.list_cms_kits())[0] if not saved.itens else CmsKitResponse(
            id=saved.id,
            nome=saved.nome,
            slug=saved.slug,
            descricao=saved.descricao,
            publico=saved.publico,
            ordem=saved.ordem,
            itens=[
                KitItemResponse(
                    id=it.id,
                    produto_id=it.produto_id,
                    produto=self.to_public_produto(it.produto) if it.produto else None,
                    quantidade=it.quantidade,
                    ordem=it.ordem,
                )
                for it in saved.itens
            ],
            is_active=saved.is_active,
            created_at=saved.created_at,
            updated_at=saved.updated_at,
        )

    async def delete_kit(self, kit_id: str) -> None:
        deleted = await self.repository.delete_kit(kit_id)
        if not deleted:
            raise KitNotFoundError(f"Kit {kit_id} não encontrado.")
