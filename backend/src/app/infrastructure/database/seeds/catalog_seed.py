from datetime import timedelta
from decimal import Decimal

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.catalog import Departamento, Kit, KitItem, Produto
from app.domain.schemas.catalog import hoje_sao_paulo

# Dados extraídos fielmente de prototipo/fonte/p4.html para ambiente de desenvolvimento/demonstração
DEPARTAMENTOS_SEED = [
    {
        "slug": "casa-e-pisos",
        "nome": "Casa e pisos",
        "icone": "home",
        "descricao": "Desinfetante, multiuso, cera",
        "uso": "Dilua conforme o rótulo e aplique com pano úmido ou mop. Em piso, passe e deixe secar naturalmente.",
        "cuidado": "Não misture com água sanitária nem outros produtos. Guarde longe de crianças e animais.",
        "ordem": 1,
    },
    {
        "slug": "cozinha",
        "nome": "Cozinha",
        "icone": "pot",
        "descricao": "Detergente, esponja, desengordurante",
        "uso": "Use pouco produto com água morna. Em gordura pesada, aplique, aguarde 1 a 2 minutos e enxágue.",
        "cuidado": "Enxágue bem as superfícies que tocam alimentos. Evite contato com os olhos.",
        "ordem": 2,
    },
    {
        "slug": "roupas",
        "nome": "Roupas",
        "icone": "shirt",
        "descricao": "Sabão, amaciante, tira-manchas",
        "uso": "Siga a medida da tampa conforme a carga. Separe brancas e coloridas e teste peças delicadas antes.",
        "cuidado": "Não aplique direto em tecido seco escuro. Mantenha a embalagem fechada.",
        "ordem": 3,
    },
    {
        "slug": "banheiro",
        "nome": "Banheiro",
        "icone": "drop",
        "descricao": "Sanitária, antilimo, pedra",
        "uso": "Aplique, deixe agir de 5 a 10 minutos, esfregue e enxágue. Mantenha o ambiente ventilado.",
        "cuidado": "Nunca misture com amoníaco, vinagre ou álcool. Use luvas.",
        "ordem": 4,
    },
    {
        "slug": "descartaveis",
        "nome": "Descartáveis",
        "icone": "roll",
        "descricao": "Papel, saco de lixo, toalha",
        "uso": "Armazene em local seco e arejado, longe do chão molhado.",
        "cuidado": "Não reutilize sacos de lixo rasgados. Feche bem antes de descartar.",
        "ordem": 5,
    },
    {
        "slug": "utensilios",
        "nome": "Utensílios",
        "icone": "bucket",
        "descricao": "Rodo, balde, pano",
        "uso": "Lave e deixe secar depois do uso. Panos de microfibra vão na máquina, sem amaciante.",
        "cuidado": "Guarde o rodo pendurado para não deformar a borracha.",
        "ordem": 6,
    },
]

PRODUTOS_SEED = [
    {
        "slug": "desinfetante-lavanda-2l",
        "dep_slug": "casa-e-pisos",
        "nome": "Desinfetante Lavanda",
        "marca": "Brisanil",
        "tamanho": "2 L",
        "de": Decimal("12.90"),
        "por": Decimal("9.90"),
        "forma": "galao",
        "cor": "#8E7CC3",
        "desc": "Perfume suave que dura no ambiente. Rende até 100 litros diluído.",
        "grande": False,
        "ordem": 1,
    },
    {
        "slug": "desinfetante-eucalipto-5l",
        "dep_slug": "casa-e-pisos",
        "nome": "Desinfetante Eucalipto",
        "marca": "Fortex",
        "tamanho": "5 L",
        "de": Decimal("27.90"),
        "por": Decimal("22.90"),
        "forma": "galao",
        "cor": "#4E9F86",
        "desc": "Galão concentrado para áreas grandes: garagem, quintal e áreas comuns.",
        "grande": True,
        "ordem": 4,
    },
    {
        "slug": "limpa-tudo-multiuso-500ml",
        "dep_slug": "casa-e-pisos",
        "nome": "Limpa Tudo Multiuso",
        "marca": "Lustrin",
        "tamanho": "500 ml",
        "de": Decimal("6.49"),
        "por": Decimal("4.99"),
        "forma": "garrafa",
        "cor": "#3D8BC9",
        "desc": "Pronto pra usar em fogão, azulejo, bancada e geladeira.",
        "grande": False,
        "ordem": 6,
    },
    {
        "slug": "lustra-moveis-200ml",
        "dep_slug": "casa-e-pisos",
        "nome": "Lustra-móveis",
        "marca": "Lustrin",
        "tamanho": "200 ml",
        "de": Decimal("8.90"),
        "forma": "spray",
        "cor": "#C29A55",
        "desc": "Brilho sem deixar a madeira grudenta. Tira o pó e protege.",
        "grande": False,
        "ordem": 15,
    },
    {
        "slug": "cera-liquida-incolor-750ml",
        "dep_slug": "casa-e-pisos",
        "nome": "Cera Líquida Incolor",
        "marca": "Brisanil",
        "tamanho": "750 ml",
        "de": Decimal("14.90"),
        "forma": "garrafa",
        "cor": "#B7A07A",
        "desc": "Para pisos frios e laminados. Seca rápido e não amarela.",
        "grande": False,
        "ordem": 16,
    },
    {
        "slug": "detergente-neutro-500ml",
        "dep_slug": "cozinha",
        "nome": "Detergente Neutro",
        "marca": "Clarim",
        "tamanho": "500 ml",
        "de": Decimal("2.99"),
        "por": Decimal("2.19"),
        "forma": "deterg",
        "cor": "#7DB548",
        "desc": "O mais vendido da loja. Faz espuma na medida e é suave com as mãos.",
        "grande": False,
        "ordem": 2,
    },
    {
        "slug": "desengordurante-500ml",
        "dep_slug": "cozinha",
        "nome": "Desengordurante",
        "marca": "Fortex",
        "tamanho": "500 ml",
        "de": Decimal("11.90"),
        "por": Decimal("9.49"),
        "forma": "spray",
        "cor": "#D9773F",
        "desc": "Tira gordura de fogão, coifa e azulejo em poucos minutos.",
        "grande": False,
        "ordem": 8,
    },
    {
        "slug": "esponja-dupla-face-4un",
        "dep_slug": "cozinha",
        "nome": "Esponja Dupla Face",
        "marca": "Pratiq",
        "tamanho": "pacote c/ 4",
        "de": Decimal("7.90"),
        "forma": "esponja",
        "cor": "#E8BD45",
        "desc": "Lado macio para o dia a dia e fibra para panela difícil.",
        "grande": False,
        "ordem": 7,
    },
    {
        "slug": "detergente-neutro-5l",
        "dep_slug": "cozinha",
        "nome": "Detergente Neutro",
        "marca": "Clarim",
        "tamanho": "5 L",
        "de": Decimal("24.90"),
        "por": Decimal("19.90"),
        "forma": "galao",
        "cor": "#6AAE8F",
        "desc": "O mesmo detergente, em galão. Sai mais barato por lavagem.",
        "grande": True,
        "ordem": 9,
    },
    {
        "slug": "lava-roupas-em-po-1-6kg",
        "dep_slug": "roupas",
        "nome": "Lava-roupas em Pó",
        "marca": "Alvura",
        "tamanho": "1,6 kg",
        "de": Decimal("21.90"),
        "por": Decimal("17.90"),
        "forma": "caixa",
        "cor": "#4A7CCB",
        "desc": "Limpeza profunda em água fria. Rende até 32 lavagens.",
        "grande": False,
        "ordem": 5,
    },
    {
        "slug": "amaciante-concentrado-2l",
        "dep_slug": "roupas",
        "nome": "Amaciante Concentrado",
        "marca": "Alvura",
        "tamanho": "2 L",
        "de": Decimal("19.90"),
        "forma": "galao",
        "cor": "#D98FB5",
        "desc": "Meia tampa por lavagem. Roupa macia e perfumada por dias.",
        "grande": False,
        "ordem": 10,
    },
    {
        "slug": "tira-manchas-sem-cloro-1l",
        "dep_slug": "roupas",
        "nome": "Tira-manchas sem Cloro",
        "marca": "Alvura",
        "tamanho": "1 L",
        "de": Decimal("13.90"),
        "forma": "garrafa",
        "cor": "#D46F96",
        "desc": "Para brancas e coloridas. Não desbota quando usado na medida.",
        "grande": False,
        "ordem": 13,
    },
    {
        "slug": "agua-sanitaria-2l",
        "dep_slug": "banheiro",
        "nome": "Água Sanitária",
        "marca": "Clarim",
        "tamanho": "2 L",
        "de": Decimal("6.90"),
        "forma": "galao",
        "cor": "#5AA3D0",
        "desc": "Desinfeta, alveja e tira mofo. Regularizada na Anvisa.",
        "grande": False,
        "ordem": 3,
    },
    {
        "slug": "limpa-banheiro-antilimo-500ml",
        "dep_slug": "banheiro",
        "nome": "Limpa Banheiro Antilimo",
        "marca": "Fortex",
        "tamanho": "500 ml",
        "de": Decimal("12.90"),
        "forma": "spray",
        "cor": "#3AAFA9",
        "desc": "Remove limo e marca de água do box e do rejunte.",
        "grande": False,
        "ordem": 11,
    },
    {
        "slug": "pedra-sanitaria-pinho-3un",
        "dep_slug": "banheiro",
        "nome": "Pedra Sanitária Pinho",
        "marca": "Brisanil",
        "tamanho": "c/ 3",
        "de": Decimal("9.90"),
        "forma": "caixa",
        "cor": "#62B06A",
        "desc": "Perfuma a cada descarga. Cada pedra dura cerca de 30 dias.",
        "grande": False,
        "ordem": 14,
    },
    {
        "slug": "papel-higienico-folha-dupla-64un",
        "dep_slug": "descartaveis",
        "nome": "Papel Higiênico Folha Dupla",
        "marca": "Pratiq",
        "tamanho": "fardo c/ 64 rolos",
        "de": Decimal("119.90"),
        "por": Decimal("94.90"),
        "forma": "rolo",
        "cor": "#8FB0D6",
        "desc": "Fardo econômico para escritório, condomínio e família grande.",
        "grande": True,
        "ordem": 12,
    },
    {
        "slug": "saco-de-lixo-100l-50un",
        "dep_slug": "descartaveis",
        "nome": "Saco de Lixo 100 L",
        "marca": "Pratiq",
        "tamanho": "pacote c/ 50",
        "de": Decimal("29.90"),
        "forma": "saco",
        "cor": "#4F5D6B",
        "desc": "Reforçado, aguenta lixeira de condomínio sem rasgar.",
        "grande": True,
        "ordem": 17,
    },
    {
        "slug": "papel-toalha-interfolha-1000fls",
        "dep_slug": "descartaveis",
        "nome": "Papel Toalha Interfolha",
        "marca": "Pratiq",
        "tamanho": "pacote c/ 1.000 folhas",
        "de": Decimal("22.90"),
        "forma": "caixa",
        "cor": "#9DB9C2",
        "desc": "Para dispenser de banheiro e cozinha profissional.",
        "grande": True,
        "ordem": 18,
    },
    {
        "slug": "pano-de-microfibra-3un",
        "dep_slug": "utensilios",
        "nome": "Pano de Microfibra",
        "marca": "Lustrin",
        "tamanho": "c/ 3",
        "de": Decimal("16.90"),
        "por": Decimal("12.90"),
        "forma": "pano",
        "cor": "#E58A6A",
        "desc": "Limpa vidro e inox sem deixar fiapo. Lava e usa de novo.",
        "grande": False,
        "ordem": 19,
    },
    {
        "slug": "rodo-de-aluminio-60cm",
        "dep_slug": "utensilios",
        "nome": "Rodo de Alumínio 60 cm",
        "marca": "Pratiq",
        "tamanho": "cabo 1,2 m",
        "de": Decimal("34.90"),
        "forma": "rodo",
        "cor": "#7A8C99",
        "desc": "Borracha dupla que puxa a água de uma vez. Cabo firme.",
        "grande": False,
        "ordem": 20,
    },
    {
        "slug": "balde-com-espremedor-20l",
        "dep_slug": "utensilios",
        "nome": "Balde com Espremedor",
        "marca": "Pratiq",
        "tamanho": "20 L",
        "de": Decimal("69.90"),
        "forma": "balde",
        "cor": "#4C9CC2",
        "desc": "Espreme o mop sem molhar a mão. Rodinhas para áreas grandes.",
        "grande": True,
        "ordem": 21,
    },
]

KITS_SEED = [
    {
        "slug": "kit-condominio",
        "nome": "Kit Condomínio",
        "publico": "condominio",
        "descricao": "Áreas comuns, garagem e lixeira · por mês",
        "ordem": 1,
        "itens": [
            ("agua-sanitaria-2l", 12),
            ("desinfetante-eucalipto-5l", 4),
            ("saco-de-lixo-100l-50un", 4),
            ("detergente-neutro-5l", 1),
            ("pano-de-microfibra-3un", 3),
            ("rodo-de-aluminio-60cm", 1),
        ],
    },
    {
        "slug": "kit-restaurante",
        "nome": "Kit Restaurante",
        "publico": "restaurante",
        "descricao": "Cozinha e salão de até 40 lugares · por semana",
        "ordem": 2,
        "itens": [
            ("detergente-neutro-5l", 4),
            ("desengordurante-500ml", 6),
            ("esponja-dupla-face-4un", 10),
            ("agua-sanitaria-2l", 12),
            ("papel-toalha-interfolha-1000fls", 5),
            ("saco-de-lixo-100l-50un", 4),
        ],
    },
    {
        "slug": "kit-salao-de-beleza",
        "nome": "Kit Salão de Beleza",
        "publico": "salao",
        "descricao": "Bancadas, lavatórios e banheiro · por mês",
        "ordem": 3,
        "itens": [
            ("desinfetante-lavanda-2l", 6),
            ("papel-toalha-interfolha-1000fls", 5),
            ("limpa-banheiro-antilimo-500ml", 2),
            ("pano-de-microfibra-3un", 2),
            ("saco-de-lixo-100l-50un", 2),
            ("limpa-tudo-multiuso-500ml", 12),
        ],
    },
    {
        "slug": "kit-escritorio",
        "nome": "Kit Escritório",
        "publico": "escritorio",
        "descricao": "Até 20 pessoas · por mês",
        "ordem": 4,
        "itens": [
            ("papel-higienico-folha-dupla-64un", 2),
            ("papel-toalha-interfolha-1000fls", 5),
            ("limpa-tudo-multiuso-500ml", 12),
            ("detergente-neutro-500ml", 24),
            ("desinfetante-lavanda-2l", 6),
            ("saco-de-lixo-100l-50un", 2),
        ],
    },
]


async def seed_catalog(session: AsyncSession) -> dict[str, int]:
    """Popula os dados de catálogo no banco de desenvolvimento.

    Idempotente: atualiza se já existir pelo slug.
    """
    hoje = hoje_sao_paulo()
    proximo_sabado = hoje + timedelta(days=((5 - hoje.weekday()) % 7 or 7))

    # 1. Departamentos
    depts_by_slug: dict[str, Departamento] = {}
    total_depts = 0
    for data in DEPARTAMENTOS_SEED:
        stmt = select(Departamento).where(Departamento.slug == data["slug"])
        res = await session.execute(stmt)
        dept = res.scalar_one_or_none()
        if dept is None:
            dept = Departamento(
                nome=data["nome"],
                slug=data["slug"],
                descricao=data["descricao"],
                icone=data["icone"],
                uso=data["uso"],
                cuidado=data["cuidado"],
                ordem=data["ordem"],
                is_active=True,
                created_by="seed@dev",
            )
            session.add(dept)
            total_depts += 1
        else:
            dept.nome = data["nome"]
            dept.descricao = data["descricao"]
            dept.icone = data["icone"]
            dept.uso = data["uso"]
            dept.cuidado = data["cuidado"]
            dept.ordem = data["ordem"]
        await session.flush()
        depts_by_slug[data["slug"]] = dept

    # 2. Produtos
    prods_by_slug: dict[str, Produto] = {}
    total_prods = 0
    for p in PRODUTOS_SEED:
        dept = depts_by_slug[p["dep_slug"]]
        stmt = select(Produto).where(Produto.slug == p["slug"])
        res = await session.execute(stmt)
        prod = res.scalar_one_or_none()

        preco_por = p.get("por")
        promo_inicio = hoje if preco_por else None
        promo_fim = proximo_sabado if preco_por else None

        if prod is None:
            prod = Produto(
                departamento_id=dept.id,
                nome=p["nome"],
                slug=p["slug"],
                marca=p["marca"],
                tamanho=p["tamanho"],
                descricao=p["desc"],
                forma=p["forma"],
                cor=p["cor"],
                preco_de=p["de"],
                preco_por=preco_por,
                promo_inicio=promo_inicio,
                promo_fim=promo_fim,
                embalagem_grande=p["grande"],
                ordem=p["ordem"],
                is_active=True,
                created_by="seed@dev",
            )
            session.add(prod)
            total_prods += 1
        else:
            prod.departamento_id = dept.id
            prod.nome = p["nome"]
            prod.marca = p["marca"]
            prod.tamanho = p["tamanho"]
            prod.descricao = p["desc"]
            prod.forma = p["forma"]
            prod.cor = p["cor"]
            prod.preco_de = p["de"]
            prod.preco_por = preco_por
            prod.promo_inicio = promo_inicio
            prod.promo_fim = promo_fim
            prod.embalagem_grande = p["grande"]
            prod.ordem = p["ordem"]
        await session.flush()
        prods_by_slug[p["slug"]] = prod

    # 3. Kits e KitItem
    total_kits = 0
    for k in KITS_SEED:
        stmt = select(Kit).where(Kit.slug == k["slug"])
        res = await session.execute(stmt)
        kit = res.scalar_one_or_none()
        if kit is None:
            kit = Kit(
                nome=k["nome"],
                slug=k["slug"],
                publico=k["publico"],
                descricao=k["descricao"],
                ordem=k["ordem"],
                is_active=True,
                created_by="seed@dev",
            )
            session.add(kit)
            total_kits += 1
        else:
            kit.nome = k["nome"]
            kit.publico = k["publico"]
            kit.descricao = k["descricao"]
            kit.ordem = k["ordem"]
        await session.flush()

        # Recria itens
        await session.execute(delete(KitItem).where(KitItem.kit_id == kit.id))
        for ordem, (prod_slug, qtd) in enumerate(k["itens"], start=1):
            prod = prods_by_slug.get(prod_slug)
            if prod:
                item = KitItem(
                    kit_id=kit.id,
                    produto_id=prod.id,
                    quantidade=qtd,
                    ordem=ordem,
                )
                session.add(item)

    await session.commit()
    return {
        "departamentos": len(depts_by_slug),
        "produtos": len(prods_by_slug),
        "kits": len(KITS_SEED),
    }
