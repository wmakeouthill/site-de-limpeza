# Spec: Site e CMS da Falcão Limpeza (Anil)

> Status: rascunho para aprovação · 2026-10-19, marca Falcão Limpeza em 2026-10-20 · documento vivo (atualize quando a realidade divergir).
> Referência visual e de conteúdo: `prototipo/` (ver `prototipo/LEIAME.md`).

## 0. Contexto autossuficiente

Leia esta seção inteira antes de qualquer outra coisa. Ela basta para trabalhar sem a conversa
que gerou o documento.

### Produto

A **Falcão Limpeza** (mesmo dono da Falcon Advocacia, de onde vem o CMS) é uma loja **física** de produtos de limpeza no Anil, Rio de Janeiro
(Estrada de Jacarepaguá, 5171, pertinho de Rio das Pedras). Atende **casas** (varejo) e
**empresas** (condomínio, restaurante, salão, escritório — compra em quantidade).

O site **não vende online**. Ele serve para:

1. mostrar o catálogo com o preço da loja e as ofertas da semana ("de R$ X por R$ Y");
2. o visitante montar uma **lista** e mandar pelo **WhatsApp** para a loja separar (retirada
   ou pergunta de entrega);
3. empresas pedirem **cotação de atacado** pelo WhatsApp (preço combinado, nunca tabelado);
4. ensinar a limpar melhor (**guias de limpeza** e **artigos**, incluindo "A gente testou");
5. mostrar **depoimentos** e os dados da loja (endereço, horário, pagamento, bairros de entrega).

A equipe da loja controla **tudo pelo CMS**: produtos/catálogo, preços e ofertas, promoções de
entrada (popup), guias, artigos, depoimentos e dados da loja.

**Ponto de partida:** copiar o projeto do site Falcon (`D:\freela-workspace\falcon-advocacia-site`),
que já tem site público Astro + CMS React + API FastAPI com login, artigos, guias, depoimentos,
uploads e métricas, e adaptá-lo. **Não reescrever do zero** o que o Falcon já resolve.

### Arquitetura e stack (herdadas do Falcon)

- **Site público:** Astro 5 com `@astrojs/node` (standalone). Páginas que leem dados do CMS são
  SSR (`export const prerender = false`) e buscam a API pelo servidor (`src/lib/server/publicContent.ts`).
  Ilhas React só onde há interação (lista, filtros, popup, formulários).
- **CMS:** SPA React 19 montada em `src/pages/cms/[...path].astro` (`client:only`), react-router-dom 7,
  editor BlockNote (salva Markdown), lucide-react.
- **BFF:** `src/pages/api/[...path].ts` repassa para a API com allowlist (`src/lib/server/falconApiProxy.ts`);
  `src/pages/media/[...path].ts` serve mídia.
- **API:** FastAPI + SQLAlchemy async + Alembic + Postgres 16, em `backend/src/app/` com camadas
  `domain/` (entidades, repositórios, schemas), `application/services/`, `infrastructure/`,
  `interfaces/api/v1/routers/`. Rotas públicas em `/api/public/*`, do CMS em `/api/cms/*`.
- **Auth do CMS:** e-mail + senha (argon2id), allowlist `CMS_ALLOWED_EMAILS`, senha definida por
  `python -m app.cli set-password`, sessão revogável em cookie HttpOnly + CSRF, rate limit.
- **Ambiente local:** `compose.yaml` (postgres, backend, frontend).

### Glossário

| Termo | Significado |
| --- | --- |
| Modo casa / empresa | Preferência do visitante (alternador no topo). Muda textos e destaques; não muda preço. |
| Preço da loja | `preco_de` do produto: o que se paga no balcão. |
| Oferta / promoção de preço | Produto com `preco_por` menor que `preco_de` dentro do período. Exibida como "de R$ X por R$ Y". |
| Promoção de entrada | Aviso (popup) configurado no CMS que aparece ao entrar no site para chamar atenção. Entidade `Promocao`. |
| Lista | "Carrinho" sem pagamento: fica no navegador e vira mensagem de WhatsApp. |
| Cotação | Pedido de preço de atacado de uma empresa, montado no site e enviado pelo WhatsApp. |
| Kit | Conjunto sugerido de produtos com quantidades para um tipo de empresa (ex.: condomínio). |
| Guia | Passo a passo de limpeza com "o que você vai precisar" ligado a produtos. |
| Artigo | Texto editorial; a categoria "A gente testou" é um artigo de teste comparativo. |
| Departamento | Grupo do catálogo (Casa e pisos, Cozinha, Roupas, Banheiro, Descartáveis, Utensílios). |

### Mapa de arquivos

| Onde | O quê |
| --- | --- |
| `prototipo/` | Protótipo navegável (referência de layout, textos e comportamento). **Não editar** como parte do site. |
| `prototipo/fonte/p1.html` | CSS e tokens da paleta azul royal e amarelo (claro e escuro) — base do CSS do site. |
| `prototipo/fonte/p4.html` | Dados de exemplo (departamentos, produtos, kits, guias, bairros) — base do seed de desenvolvimento. |
| `prototipo/marca/` | `simbolo.png`, o selo em uso (1024 px, transparente); `codex/` com as propostas originais. |
| `docs/specs/site-falcao-limpeza.md` | Esta spec. |
| `docs/superpowers/plans/` | Plano de implementação (escrito a partir desta spec). |
| `docs/prompts/implementar-site-falcao-limpeza.md` | Prompts para planejar, executar e retomar. |
| Após a cópia (raiz) | `package.json`, `astro.config.mjs`, `src/`, `backend/`, `compose.yaml`, `Dockerfile`, `.env.example` vindos do Falcon. |

### Como rodar e testar (comandos herdados do Falcon)

```bash
docker compose up -d postgres
cd backend && uv run alembic upgrade head
cd backend && uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
cd backend && uv run pytest -v
cd backend && uv run ruff check .
npm run dev
npm run test:unit
npm run test:e2e
npx astro check
npm run build
```

### O que não fazer

- Não copiar `.env*`, chaves, uploads, banco, dados ou conteúdo do Falcon. Só arquivos versionados
  (`git archive HEAD`), e depois remover tudo que é específico do Falcon (seção 2).
- Não escrever no projeto Falcon (ele é só origem de leitura).
- Não vender online, não ter checkout nem pagamento.
- Não prometer preço por quantidade ("cai a partir de 4 unidades") em lugar nenhum.
- Não usar a palavra "vitrine" em texto do site.
- Não publicar marcas, preços, telefone ou horário do protótipo como se fossem reais.
- Não fazer commit, push, PR, deploy ou criar recurso de nuvem sem ordem explícita.

## Interfaces já definidas

Resumo do que as seções abaixo fixam. Detalhe na seção indicada.

- **Páginas:** `/`, `/produtos` (`?q=`, filtros e ordem na query), `/produtos/{slug}`,
  `/empresas`, `/guias`, `/guias/{slug}`, `/artigos`, `/artigos/{slug}`, `/loja`,
  `/privacidade`, `/cms/*`; `?modo=empresa` em qualquer página (3, 13).
- **Navegador (`localStorage`):** `falcao-modo` = `casa | empresa`; `falcao-lista` =
  `{ [produto_id]: 1..999 }`; `falcao-promo-vista` = `{ [promocao_id]: "AAAA-MM-DD" }` (3, 4, 6).
- **Regra de oferta** (API, `America/Sao_Paulo`): `promo_ativa = preco_por < preco_de e
  (promo_inicio nulo ou hoje >= promo_inicio) e hoje <= promo_fim`;
  `desconto_pct = piso((de - por) / de * 100)` (6).
- **Mensagens de WhatsApp:** lista (RF-L03), cotação (RF-L04), bairro (RF-P09); link
  `https://wa.me/{whatsapp_numero}?text=…` (RF-L06).
- **Tabelas novas:** `departamentos`, `produtos`, `kits`, `kit_itens`, `promocoes`,
  `guide_details`, `guide_produtos`. **Alteradas:** `content_entries.content_type` (`article |
  guide`), `article_details.categoria`, `site_settings` (9), `site_events.event` (10) (11).
- **Enums:** `Forma`, `Icone`, `PublicoGuia`, `PublicoPromocao`, `TipoAcao`, `Frequencia`,
  `CategoriaArtigo`, `SiteScope.FALCAO_LIMPEZA` (11).
- **API pública** (`/api/public`): `site-settings`, `departamentos`, `produtos`,
  `produtos/{slug}`, `kits`, `promocoes/ativas`, `guides[/{slug}]`, `articles[/{slug}]` + likes,
  `testimonials`, `track.js`, `events`, `tracking/forget`. Tipos `ProdutoCartao`,
  `ProdutoDetalhe`, `Kit`, `PromocaoPublica`, `GuiaCartao`, `GuiaDetalhe` (11).
- **API do CMS** (`/api/cms`): `produtos` (+ `?oferta=`, `/marcas`), `departamentos`
  (+ `/reorder`), `kits` (+ `/reorder`), `promocoes`, `guides`, e as do Falcon (artigos,
  depoimentos, autores, uploads, links de campanha, settings, analytics, auth) (11).
- **Eventos novos** (`SiteEventType`, detalhe em `target`): `whatsapp_click`, `lista_add`,
  `busca`, `popup_view`, `popup_click`, `popup_close` (10).

## Índice

- [x] 1. Objetivo e escopo
- [x] 2. Ponto de partida: cópia do Falcon
- [x] 3. Site público
- [x] 4. Lista, cotação e WhatsApp
- [x] 5. Catálogo no CMS
- [x] 6. Promoções (preço e entrada)
- [x] 7. Guias e artigos
- [x] 8. Depoimentos
- [x] 9. Dados da loja (configurações)
- [x] 10. Métricas
- [x] 11. Modelo de dados e contratos de API
- [x] 12. Identidade visual e regras de texto
- [x] 13. Segurança, privacidade, acessibilidade, SEO e desempenho
- [x] 14. Critérios de aceite
- [x] 15. Fases sugeridas para o plano
- [x] 16. Fora de escopo e em aberto

## 1. Objetivo e escopo

**Objetivo.** Pôr no ar o site da Falcão Limpeza a partir do protótipo aprovado, com tudo que muda no
dia a dia (produtos, preços, ofertas, popup de promoção, guias, artigos, depoimentos, dados da loja)
editável pela equipe no CMS, sem depender de desenvolvedor.

**Inclui**

- Site público: início, produtos (catálogo com busca e filtros), produto, para empresas (kits e
  cotação), guias, artigos (com "A gente testou"), a loja, lista e envio pelo WhatsApp.
- CMS: produtos, departamentos, kits, promoções de preço, promoções de entrada (popup), guias,
  artigos, depoimentos, dados da loja, métricas, usuários do CMS (o que o Falcon já tem).
- API e banco novos (mesma estrutura do Falcon, migration inicial única).
- Seed de demonstração (só desenvolvimento/teste) a partir de `prototipo/fonte/p4.html`.

**Não inclui**

- Venda online, checkout, pagamento, cadastro de cliente, área do cliente.
- Controle de estoque, integração com PDV/ERP, emissão de nota.
- Tabela de preço de atacado ou preço por quantidade.
- Formulário de contato por e-mail (o canal é o WhatsApp).
- Deploy, domínio e infraestrutura de produção (tarefa separada, com ordem explícita).

## 2. Ponto de partida: cópia do Falcon

Origem: `D:\freela-workspace\falcon-advocacia-site`, **somente leitura**. Destino: a raiz deste
repositório (`D:\freela-workspace\falcao-limpeza`), ao lado de `prototipo/` e `docs/`.

**Como copiar.** Só arquivos versionados, via `git -C <origem> archive HEAD` extraído numa pasta
temporária e movido para a raiz. Nunca copiar `.env*`, `node_modules`, `.venv`, `dist`, `.astro`,
uploads, `graphify-out` ou o banco. Registrar no plano o commit de origem usado.

**RF-C01 Manter (só trocando marca e nomes "falcon")**

- Auth do CMS completa: login, sessão revogável, refresh, logout, CSRF, rate limit, allowlist,
  `app.cli set-password`, perfil do autor com foto.
- Uploads e mídia (`/api/cms/uploads`, `/media/...`), processamento de imagem, controle de
  posição/zoom da imagem.
- Editor de conteúdo (BlockNote → Markdown) e `ContentRenderer`.
- Artigos: entidade de conteúdo, rascunho/publicado/arquivado, `first_published_at`, autor
  publicado, curtidas.
- Depoimentos: CRUD e reordenação.
- Métricas: `track.js`, eventos, painel, links de campanha, "esquecer meus dados", retenção.
- Sitemap, IndexNow, cache público, healthcheck, proxy com allowlist, `compose.yaml`, `Dockerfile`,
  infraestrutura de testes (Vitest, Playwright, pytest, ruff, `astro check`).

**RF-C02 Adaptar**

- Tipo de conteúdo `case` vira `guide` (seção 7). `CaseDetail`, `CaseMetric`, `CaseTag` saem;
  entra `GuideDetail`. Rotas `/api/cms/cases*` → `/api/cms/guides*`, `/api/public/cases*` →
  `/api/public/guides*`. `CaseEditorPage` vira `GuideEditorPage`.
- `ArticleDetail.area` vira `categoria` (seção 7).
- `SiteScope.FALCON` vira `SiteScope.FALCAO_LIMPEZA = "falcao_limpeza"`.
- `SiteSettings` troca os campos do Falcon pelos dados da loja (seção 9).
- `falconApiProxy.ts` → `apiProxy.ts`; `FALCON_API_INTERNAL_URL` → `API_INTERNAL_URL`. Demais
  nomes com "falcon" no código, testes e textos do CMS trocados por "falcao"/"Falcão Limpeza".
  Atenção: a origem é "falcon", o destino é "falcao"; `grep -ri falcon` segue valendo como checagem.
- Migrations: as do Falcon são substituídas por **uma** migration inicial (`0001`) com o modelo
  herdado já adaptado (sem cases e sem contato); cada fase seguinte acrescenta a sua. Banco novo,
  sem dados a migrar.
- Casca do CMS (menu, logo, cores) com a identidade da seção 12.
- Site público: os componentes da landing Falcon são substituídos pelos do protótipo (seção 3).

**RF-C03 Remover**

- Contato por e-mail inteiro: entidade e repositório de mensagens, serviços de contato, despachante,
  jornada do lead, rotas `/api/public/contact` e `/api/cms/contacts*`, página e componentes de
  contatos do CMS, exportação, `src/pages/api/contact.ts`, `src/lib/contactAreas.ts`, Resend e
  variáveis `CONTACT_*`/`RESEND_*`. O scheduler sai junto se só servir ao despachante (conferir).
- Flag `PUBLIC_TESTIMONIALS_ENABLED` (aqui depoimentos são públicos).
- Tudo que é do Falcon: imagens, logos, fotos, `posts/`, `docs/cms/`, specs/planos/prompts do
  Falcon, `deploy/`, `PLANO_IMPLEMENTACAO.md`, `vercel.json`, arquivos soltos de design/rascunho na
  raiz (`*.zip`, `*.dc.html`, `support.js`, `.thumbnail`, `.codesight/`), `public/email/`.
- Ao fim da limpeza, `grep -ri falcon` no código e nos textos não acha nada (exceto este
  documento e o plano, que citam a origem).

## 3. Site público

Layout, textos e comportamento seguem o protótipo (`prototipo/index.html`). URLs reais
substituem o roteador de página única do protótipo. Tudo que vem do CMS é renderizado no
servidor; a ausência de dado esconde o bloco, nunca mostra placeholder.

**RF-P01 Estrutura comum.** Topo com logo, busca, alternador "Pra casa / Pra empresa" e botão
"Minha lista" com contador; navegação Início, Produtos, Para empresas, Como usar (`/guias`),
A loja; no celular, barra inferior (Início, Produtos, Lista, Loja, WhatsApp); botão flutuante
"Fale com a loja"; rodapé com logo, endereço, horário, WhatsApp e links. A faixa
"Protótipo navegável…" do protótipo **não** existe no site.

**RF-P02 Busca.** O campo do topo leva a `/produtos?q=`. A busca ignora acento e caixa e exige
todas as palavras em nome, marca, tamanho, departamento ou descrição.

**RF-P03 Início (`/`).** Na ordem do protótipo:
1. Hero: "Tudo limpo, sem complicar.", texto de apoio, botões "Ver produtos" e "Como chegar",
   endereço; cartão "Esta semana" com a oferta ativa de menor `ordem`.
2. Faixa de vantagens: preço da loja na tela; prazo de separação (texto do CMS, some se vazio);
   entrega na região; atacado pra empresas com "Preço combinado pelo WhatsApp".
3. Departamentos ativos.
4. "O que está valendo a pena": até 8 ofertas ativas; subtítulo "Válido até {menor data de fim}
   ou enquanto durar o estoque."; cartão cuja data difere mostra a própria. Sem ofertas, a seção
   some.
5. Bloco empresas (link para `/empresas`).
6. "Como funciona a lista" (3 passos).
7. Guias em destaque (até 3, publicados).
8. Depoimentos ativos (seção 8). Sem depoimentos, a seção some.
9. Loja: mapa ilustrativo do protótipo ("fora de escala"), endereço, horário, "Abrir no Google
   Maps" (`maps_url`), link para `/loja`. Sem iframe de mapa de terceiros.

**RF-P04 Produtos (`/produtos`).** Lista de produtos ativos com filtros do protótipo:
departamento; preço atual (até R$ 10, de R$ 10 a R$ 30, acima de R$ 30); "Só ofertas";
"Embalagem grande"; marca (várias). Ordenação: mais procurados (`ordem`), menor preço, maior
desconto, A–Z. Contador de resultados com `aria-live`. Filtros, ordenação e busca ficam na query
string (dá pra compartilhar e voltar). Sem resultado: mensagem + "Limpar filtros".
`ponytail:` filtra no navegador sobre o catálogo inteiro renderizado no servidor; aguenta algumas
centenas de produtos — paginar/filtrar na API se passar de ~1.000.

**RF-P05 Produto (`/produtos/{slug}`).** Nome, marca, tamanho, imagem (ou ilustração por
`forma`/`cor` quando não houver foto), preço (seção 6), seletor de quantidade com subtotal,
"Pôr na lista", descrição, "Como usar" (`como_usar` do produto ou `uso` do departamento),
"Cuidado" (`cuidado` do departamento), guias que usam o produto, até 4 produtos do mesmo
departamento. No modo empresa, chamada "Comprando em quantidade? O preço de atacado a gente
combina pelo WhatsApp." Produto inexistente ou inativo → 404.

**RF-P06 Para empresas (`/empresas`).** "Limpeza no atacado, com atendimento de bairro.",
vantagens (preço de atacado combinado, separado pra retirada, entrega na região), kits ativos
(itens com quantidade, total estimado "com o preço da loja", "Pôr o kit na lista"), "Do pedido à
retirada", formulário de cotação (seção 4), depoimentos.

**RF-P07 Guias (`/guias`, `/guias/{slug}`).** Lista de guias publicados com filtro
casa/empresa/todos (padrão: o modo atual) e seção "Artigos e testes" com os artigos recentes.
Página do guia na seção 7. `guides_enabled = false` → 404 e some da navegação.

**RF-P08 Artigos (`/artigos`, `/artigos/{slug}`).** Lista com filtro por categoria; página com
autor, data, tempo de leitura, capa, corpo e curtidas (como no Falcon). Categoria "A gente
testou" ganha selo próprio. `articles_enabled = false` → 404 e some da navegação.

**RF-P09 A loja (`/loja`).** "Venha ver de perto.", endereço, mapa ilustrativo, Google Maps,
horários, WhatsApp e telefone, formas de pagamento, e "Entrega no seu bairro?": com menos de 3
letras pede mais; compara sem acento/caixa contra `bairros_entrega` (um contém o outro); achou →
"**{bairro}** está na nossa rota de entrega. Combine dia e horário pelo WhatsApp." + botão de
WhatsApp com "{saudação} Moro em {bairro}. Como funciona a entrega?"; não achou → diz que ainda
não está na lista e oferece perguntar pelo WhatsApp.

**RF-P10 Modo casa/empresa.** Alternador no topo; padrão casa; guardado no navegador
(`falcao-modo`); `?modo=empresa` na URL define o modo (para links de campanha). O modo troca
textos marcados e destaques; nunca muda preço.

**RF-P11 Promoção de entrada (popup).** Seção 6.

**RF-P12 Erros.** 404 com busca e links principais. API fora do ar → 503 nas páginas que dependem
dela (padrão Falcon), sem quebrar as páginas estáticas.

## 4. Lista, cotação e WhatsApp

Nada da lista ou da cotação vai para o servidor: fica no navegador e na mensagem do WhatsApp.
O número vem de `whatsapp_numero` (seção 9); nunca fica fixo no código.

**RF-L01 Lista.** Guardada no navegador em `falcao-lista` como `{ produto_id: quantidade }`
(1 a 999). Ao abrir o site, itens de produtos inexistentes ou inativos saem e os preços são
recalculados com o catálogo atual — preço salvo no navegador nunca é usado.

**RF-L02 Janela da lista.** Itens com quantidade editável e remover, subtotal por item, "Total
estimado", escolha "Retirar na loja" / "Pedir entrega" (entrega mostra campo bairro), nome
opcional, prévia da mensagem, botão "Mandar pelo WhatsApp" e "Limpar lista". Lista vazia mostra
atalho para produtos.

**RF-L03 Mensagem da lista** (formato do protótipo, `\n` entre linhas):

```text
Olá, {loja_nome}! Montei esta lista no site:

• {qtd}x {nome} {tamanho} — {preço atual} un. = {subtotal}
…

Total estimado: {total}

Quero retirar na loja. Podem separar?
```

Com entrega, a última linha vira `Vocês entregam em: {bairro ou "(meu bairro)"}?`. Se houver
nome ou modo empresa, acrescenta linha em branco e `Nome: {nome} (Compra para empresa)` (cada
parte só se existir). Valores em `R$ 0,00` (pt-BR). A saudação não repete "!" se o nome já
terminar com "!".

**RF-L04 Cotação para empresa.** Campos: empresa (obrigatório, até 80), CNPJ (opcional, sem
validação de dígito), segmento (Condomínio, Restaurante ou lanchonete, Salão ou clínica,
Escritório, Comércio, Outro), bairro (opcional, até 60), frequência (Compra única, Toda semana,
A cada 15 dias, Todo mês), "Do que você precisa?" (opcional, até 800). Sem empresa: erro no
campo com foco nele. Mensagem:

```text
Olá, {loja_nome}! Quero uma cotação para empresa.

Empresa: {empresa}
CNPJ: {cnpj}
Segmento: {segmento}
Bairro: {bairro}
Frequência: {frequência}

Preciso de:
{itens}
```

Linhas de CNPJ, bairro e o bloco "Preciso de" só aparecem se preenchidos. O site mostra a prévia
e o botão abre o WhatsApp.

**RF-L05 Kit na lista.** "Pôr o kit na lista" soma as quantidades do kit às que já estão na lista
(ignora itens inativos) e abre a lista.

**RF-L06 Link.** `https://wa.me/{whatsapp_numero}?text={encodeURIComponent(mensagem)}`, aberto em
nova aba com `rel="noopener"`. Cada clique registra `whatsapp_click` com a origem (seção 10),
sem o conteúdo da mensagem.

## 5. Catálogo no CMS

Menu do CMS: **Catálogo** (Produtos, Ofertas, Departamentos, Kits), **Promoções**, **Conteúdo**
(Guias, Artigos), **Depoimentos**, **Métricas**, **Dados da loja**.

**RF-K01 Lista de produtos.** Tabela com foto, nome, marca, tamanho, departamento, preço atual,
situação da oferta (no ar até dd/mm, agendada, sem oferta) e ativo. Busca por nome/marca, filtros
por departamento, ativo e "em oferta". Ativar/desativar direto na lista. Botão "Novo produto".

**RF-K02 Editor de produto.** Campos e validação (a API valida; o CMS mostra o erro no campo):

| Campo | Regra |
| --- | --- |
| Nome | obrigatório, até 80 |
| Slug | gerado de nome + tamanho, editável, único, `[a-z0-9-]`, até 100; ao mudar, aviso de que links antigos param de funcionar |
| Marca | obrigatório, até 40, sugere marcas já cadastradas |
| Departamento | obrigatório |
| Tamanho | obrigatório, até 30 (ex.: "500 ml", "fardo c/ 64 rolos") |
| Descrição | até 400 |
| Como usar | opcional, até 600; vazio usa o texto do departamento |
| Preço da loja (`preco_de`) | obrigatório, > 0 e ≤ 99.999,99; aceita "12,90" e "R$ 12,90" |
| Oferta: preço por, início, fim | seção 6 |
| Foto | opcional, upload do CMS com posição/zoom |
| Forma e cor | usadas só quando não há foto (ilustração do protótipo); forma da lista fixa do protótipo: `galao`, `garrafa`, `spray`, `deterg`, `esponja`, `caixa`, `rolo`, `saco`, `pano`, `rodo`, `balde`; cor hexadecimal |
| Embalagem grande | sim/não (filtro do catálogo) |
| Ordem | inteiro ≥ 0; menor aparece primeiro em "mais procurados" |
| Ativo | inativo some do site e da lista dos visitantes |

O editor mostra a prévia do cartão do produto como no site. Excluir só é possível se o produto não
estiver em kit nem em guia (senão 409 com o motivo e a sugestão de desativar).

**RF-K03 Departamentos.** Criar, editar, reordenar, ativar/desativar. Campos: nome (até 40),
slug, subtítulo (até 60, ex.: "Desinfetante, multiuso, cera"), ícone (enum `Icone`, seção 11),
"como usar" (até 600) e "cuidado" (até 400) usados na página do produto. Excluir só sem
produtos. O seed traz os seis do protótipo.

**RF-K04 Kits.** Criar, editar, reordenar, ativar/desativar. Campos: nome (até 40), slug,
subtítulo (até 80), ícone (lista fixa), itens (produto + quantidade 1–999, reordenáveis, sem
produto repetido). Kit sem itens ativos não pode ser ativado. O seed traz os quatro do protótipo.

## 6. Promoções (preço e entrada)

### Promoção de preço (oferta)

**RF-O01 Regra única, calculada na API.** Campos no produto: `preco_por` (opcional),
`promo_inicio` (data, opcional), `promo_fim` (data, obrigatória quando há `preco_por`).
Com `hoje` no fuso `America/Sao_Paulo`:

- `promo_ativa = preco_por != null e preco_por < preco_de e (promo_inicio nulo ou hoje >= promo_inicio) e hoje <= promo_fim`
- `preco_atual = promo_ativa ? preco_por : preco_de`
- `desconto_pct = promo_ativa ? piso((preco_de - preco_por) / preco_de * 100) : 0`

Validação: `0 < preco_por < preco_de`; `promo_fim >= promo_inicio`. O CMS sugere como fim o
próximo sábado. A API pública devolve os campos calculados; o site não recalcula a regra.

**RF-O02 Exibição.** Com oferta: "de ~~R$ X~~ por **R$ Y**", selo "-N%" e "até dd/mm". Sem
oferta: só o preço. Nunca "por" sem "de", nunca preço por quantidade.

**RF-O03 Tela "Ofertas" no CMS.** Lista de produtos com oferta no ar, agendada ou encerrada nos
últimos 14 dias, com edição na linha de preço por, início e fim; "Adicionar produto à oferta"
(busca); "Encerrar" (limpa `preco_por`, `promo_inicio`, `promo_fim`). É a rotina semanal da loja.

**RF-O04 Atualização.** Salvar no CMS reflete no site sem novo build. O cache público (herdado
do Falcon) é invalidado ao salvar e não pode servir oferta vencida: TTL curto ou chave que inclua
a data de hoje (conferir `infrastructure/cache/public_cache.py`).

### Promoção de entrada (popup)

**RF-E01 Cadastro (`Promocao`).** Campos:

| Campo | Regra |
| --- | --- |
| Título | obrigatório, até 60 |
| Texto | opcional, até 160 |
| Imagem | opcional, upload do CMS |
| Tipo de ação | `produto` (exige produto ativo; botões "Pôr na lista" e "Ver produto", mostra preço de/por), `link` (rótulo até 24 + caminho interno começando com `/`), `whatsapp` (rótulo até 24 + mensagem até 300; número da loja) |
| Público | `todos`, `casa` ou `empresa` |
| Início e fim | data e hora; fim obrigatório e depois do início |
| Frequência | `uma_vez` (por visitante) ou `diaria` |
| Prioridade | inteiro; maior ganha |
| Ativa | liga/desliga sem apagar |

Situação mostrada no CMS (calculada): desligada, agendada, no ar, encerrada. O CMS tem prévia
em tamanho de computador e de celular.

**RF-E02 Qual aparece.** A API pública devolve as promoções ativas e dentro do período (agora,
`America/Sao_Paulo`). O navegador escolhe **no máximo uma por sessão**: público `todos` ou igual
ao modo atual; não vista dentro da frequência; maior prioridade; empate → início mais recente.

**RF-E03 Frequência.** Fechar ou clicar marca a promoção como vista no navegador
(`falcao-promo-vista`, `{ id: data }`). `uma_vez`: nunca mais aparece para aquele visitante;
`diaria`: volta no dia seguinte. Editar a promoção não "zera" quem já viu — para mostrar de novo,
cria-se outra.

**RF-E04 Comportamento.** Abre 2 s depois que a página carregou, nunca no `/cms`, nunca por cima
da lista aberta, e não empurra o layout. `<dialog>` modal com título como rótulo acessível, foco
no primeiro botão, Esc e botão "Agora não" fecham, foco volta para onde estava. No celular, cartão
preso embaixo ocupando no máximo metade da tela (evita penalidade de intersticial). Sem animação
com `prefers-reduced-motion`.

**RF-E05 Métricas.** `popup_view`, `popup_click`, `popup_close` com `promocao_id`; o CMS mostra
por promoção: vistas, cliques e taxa de clique.

## 7. Guias e artigos

Os dois usam a entidade de conteúdo do Falcon (rascunho/publicado/arquivado, slug, título,
resumo, corpo em Markdown, capa, SEO, autor, datas). Publicar exige slug, título, resumo e corpo.

**RF-G01 Guia (`content_type = guide`) + `GuideDetail`.**

| Campo | Regra |
| --- | --- |
| Público | `casa`, `empresa` ou `ambos` |
| Tempo | minutos, 1–600 (exibe "15 min") |
| Etiqueta | até 24 (ex.: "Banheiro") |
| Ícone | lista fixa do protótipo |
| O que você vai precisar | lista ordenada de produto + quantidade (1–99) |

**RF-G02 Corpo do guia em Markdown.** Introdução em parágrafo; passos em lista numerada;
"Dica" e "Atenção" em citação começando com `**Dica:**` / `**Atenção:**`, renderizadas como
caixas destacadas; tabela de diluição como tabela GFM (Produto | Uso | Medida). O editor oferece
"Inserir modelo de guia" com esse esqueleto. O `ContentRenderer` precisa suportar tabela GFM e as
duas caixas (conferir o do Falcon).

**RF-G03 Página do guia.** Trilha "Como usar / {título}", etiqueta, tempo, público, título,
corpo, "O que você vai precisar" (só produtos ativos, com preço atual, quantidade e
"Pôr tudo na lista"), até 3 guias relacionados do mesmo público. A página do produto lista os
guias que o usam (relação inversa, sem campo no produto).

**RF-A01 Artigo.** Como no Falcon, com `categoria`: `dicas` ("Dicas"), `testamos`
("A gente testou"), `novidades` ("Novidades da loja"). Curtidas mantidas.

**RF-A02 "A gente testou".** Regra editorial: só publicar teste feito de verdade, com data,
como foi testado, fotos e resultado. O CMS mostra esse lembrete ao escolher a categoria. O teste do
protótipo (detergentes) é ilustrativo e **não** entra no seed de produção.

**RF-A03 Publicação.** Publicar, despublicar e arquivar refletem no site, sitemap e IndexNow sem
build (comportamento do Falcon).

## 8. Depoimentos

**RF-D01** Entidade do Falcon mantida: autor, papel (ex.: "Síndica"), empresa ou bairro, texto
(até 400, aceita **negrito**), foto opcional, vídeo do YouTube opcional, ordem, ativo.

**RF-D02** Públicos: aparecem no início e em `/empresas`, só os ativos, na ordem do CMS (até 6 no
início). Vídeo carrega só ao clicar (miniatura + `youtube-nocookie`), como no Falcon.

**RF-D03** O CMS lembra, no editor: "Só ative com autorização do cliente para publicar nome, foto
e texto." Depoimentos do seed são fictícios e só existem em desenvolvimento.

## 9. Dados da loja (configurações)

`SiteSettings` (registro único) com:

| Campo | Regra |
| --- | --- |
| `loja_nome` | até 40; padrão "Falcão Limpeza" |
| `whatsapp_numero` | obrigatório, só dígitos, começa com 55, 12–13 dígitos |
| `telefone_exibicao` | até 20 (ex.: "(21) 90000-0000") |
| `endereco` / `bairro_cidade` | até 120 / até 60 |
| `maps_url` | `https://`, opcional |
| `horarios` | lista de `{ dias_semana: int[] (0 = dom … 6 = sáb), abre: "HH:MM", fecha: "HH:MM" }`; o site escreve "Seg a sáb, 8h às 19h" |
| `horario_obs` | até 80 (ex.: "Feriados: 8h às 13h") |
| `pagamento` | até 160 |
| `bairros_entrega` | lista de nomes, até 60 itens de até 40 |
| `prazo_separacao` | até 40 (ex.: "Separado em ~30 min"); vazio esconde |
| `instagram_url` | `https://`, opcional |
| `articles_enabled`, `guides_enabled` | liga/desliga as seções |

Saem do Falcon: as flags de artigos por site legado e
`contact_notification_recipients`. Alterar salva e reflete no site sem build.

## 10. Métricas

Mantém o rastreamento do Falcon (`/api/public/track.js`, `POST /api/public/events`, visitas,
páginas, origens, links de campanha, `POST /api/public/tracking/forget`, retenção). No Falcon o
tipo de evento é um enum fechado (`SiteEventType`) e o detalhe vai no campo `target` (até 200);
aqui entram novos tipos nesse enum, cada um com o formato de `target` validado na API (fora do
formato → 422, nada é gravado):

| Evento | `target` |
| --- | --- |
| `whatsapp_click` | `{origem}`; origem ∈ `lista`, `cotacao`, `produto`, `bairro`, `flutuante`, `barra`, `loja`, `popup`, `rodape` |
| `lista_add` | `{origem}:{produto_slug}`; origem ∈ `cartao`, `produto`, `kit`, `guia`, `popup` |
| `busca` | `{resultados}:{termo}`; termo normalizado (minúsculo, sem acento, até 60) e sem sequência de 6+ dígitos (evita telefone/CPF) |
| `popup_view` / `popup_click` / `popup_close` | `{promocao_id}` |

`case_view` sai do enum (não há cases). `form_open`/`form_submit` ficam para a cotação
(target `cotacao`), sem conteúdo do formulário.

O painel do CMS ganha: cliques no WhatsApp por origem, produtos mais postos na lista, buscas sem
resultado e desempenho de cada promoção de entrada, no período escolhido.

## 11. Modelo de dados e contratos de API

### Convenções

- IDs `String(36)` (uuid) e auditoria `created_at`, `updated_at`, `created_by`, `updated_by`
  (e-mail do usuário do CMS), como no Falcon. Datas e horas em `timestamptz`; datas de oferta
  em `date` no calendário de `America/Sao_Paulo`.
- Domínio novo com nomes em português (`produtos`, `departamentos`, `kits`, `promocoes`); o que
  vem do Falcon mantém o nome (`content_entries`, `content_assets`, `testimonials`,
  `site_settings`, `site_events`) para não reescrever o que funciona. Tabelas novas não têm
  coluna `site` (um site só); as herdadas mantêm.
- Dinheiro: `Numeric(10,2)` no banco; no JSON, string decimal (`"12.90"`); o navegador soma em
  centavos inteiros.
- Imagem: `*_asset_id` → `content_assets` + `*_position_x`, `*_position_y`, `*_zoom` (padrão de
  `ArticleDetail.thumbnail_*` do Falcon). No JSON: `{ url, alt, x, y, zoom } | null`.
- Relações com produto usam `ON DELETE RESTRICT`; o serviço converte em 409 com o motivo.

### Enums

| Enum | Valores |
| --- | --- |
| `Forma` | `galao`, `garrafa`, `spray`, `deterg`, `esponja`, `caixa`, `rolo`, `saco`, `pano`, `rodo`, `balde` (sprite `s-*` do protótipo) |
| `Icone` | `home`, `pot`, `shirt`, `drop`, `roll`, `bucket`, `building`, `cup`, `store`, `flask`, `sparkle`, `boxes` (sprite `i-*` do protótipo) |
| `PublicoGuia` | `casa`, `empresa`, `ambos` |
| `PublicoPromocao` | `todos`, `casa`, `empresa` |
| `TipoAcao` | `produto`, `link`, `whatsapp` |
| `Frequencia` | `uma_vez`, `diaria` |
| `CategoriaArtigo` | `dicas`, `testamos`, `novidades` |
| `SiteScope` | `falcao_limpeza` |

### Tabelas novas

- **`departamentos`**: `slug` (único, até 60), `nome`, `subtitulo`, `icone`, `uso`, `cuidado`,
  `ordem`, `ativo`.
- **`produtos`**: `slug` (único, até 100), `nome`, `marca`, `departamento_id`, `tamanho`,
  `descricao`, `como_usar` (default `''`), `preco_de`, `preco_por` (nulo), `promo_inicio` (nulo),
  `promo_fim` (nulo), `imagem_*`, `forma`, `cor` (`#RRGGBB`), `embalagem_grande`, `ordem`, `ativo`.
  CHECKs: `preco_de > 0`; `preco_por` nulo ou `0 < preco_por < preco_de`; `preco_por` e
  `promo_fim` nulos juntos ou preenchidos juntos; `promo_inicio` nulo quando `preco_por` é nulo;
  `promo_inicio` nulo ou `promo_fim >= promo_inicio`. Índices: `(ativo, departamento_id)`,
  `(promo_fim)`.
- **`kits`**: `slug` (único), `nome`, `subtitulo`, `icone`, `ordem`, `ativo`.
  **`kit_itens`**: PK `(kit_id, produto_id)`, `quantidade` (1–999), `ordem`; `kit_id` em cascata.
- **`promocoes`**: `titulo`, `texto`, `imagem_asset_id` (nulo), `tipo_acao`, `produto_id` (nulo),
  `cta_rotulo`, `cta_caminho`, `whatsapp_mensagem`, `publico`, `frequencia`, `prioridade`,
  `inicio`, `fim`, `ativa`. CHECKs: `fim > inicio`; `tipo_acao = 'produto'` ⇔ `produto_id`
  preenchido; `tipo_acao = 'link'` ⇒ `cta_caminho` começa com `/` e não com `//`;
  `tipo_acao = 'whatsapp'` ⇒ `whatsapp_mensagem` não vazia.
- **`guide_details`**: PK `content_entry_id` (cascata), `publico`, `tempo_minutos` (1–600),
  `etiqueta`, `icone`. **`guide_produtos`**: PK `(content_entry_id, produto_id)`,
  `quantidade` (1–99), `ordem`.

### Tabelas alteradas ou removidas

- `content_entries.content_type`: `article` | `guide` (sai `case`).
- `article_details.area` → `categoria` (`CategoriaArtigo`).
- `site_settings`: campos da seção 9. `site_events.event`: enum da seção 10.
- Saem: `case_details`, `case_metrics`, `case_tags` e as tabelas do contato por e-mail.

### API pública

Sem login, com o cache público do Falcon. O navegador chama pelo BFF (`/api/...` do Astro),
que só repassa as rotas desta tabela; o SSR chama a API direto (`API_INTERNAL_URL`).

| Rota (GET, salvo indicado) | Resposta |
| --- | --- |
| `/api/public/site-settings` | dados da loja da seção 9 (sem campos internos) |
| `/api/public/departamentos` | `Departamento[]` ativos, por `ordem` |
| `/api/public/produtos` | `ProdutoCartao[]` ativos de departamento ativo, por `ordem` |
| `/api/public/produtos/{slug}` | `ProdutoDetalhe`; 404 se não existe, está inativo ou o departamento está inativo |
| `/api/public/kits` | `Kit[]` ativos, só com itens ativos; kit que ficaria vazio não vem |
| `/api/public/promocoes/ativas` | `PromocaoPublica[]` ativas e no período; tipo `produto` só com produto ativo |
| `/api/public/guides`, `/api/public/guides/{slug}` | `GuiaCartao[]` / `GuiaDetalhe` publicados (filtro `?publico=`) |
| `/api/public/articles`, `/articles/{slug}`, `/articles/{slug}/likes`, `POST /articles/{slug}/likes/toggle` | como no Falcon + `categoria` (filtro `?categoria=`) |
| `/api/public/testimonials` | como no Falcon |
| `/api/public/track.js`, `POST /api/public/events`, `POST /api/public/tracking/forget` | como no Falcon (seção 10) |

```ts
type Dinheiro = string;                       // "12.90"
type Imagem = { url: string; alt: string; x: number; y: number; zoom: number } | null;

type Departamento = { slug: string; nome: string; subtitulo: string; icone: Icone };

type ProdutoCartao = {
  id: string; slug: string; nome: string; marca: string; tamanho: string; descricao: string;
  departamento: { slug: string; nome: string };
  imagem: Imagem; forma: Forma; cor: string; embalagem_grande: boolean; ordem: number;
  preco_de: Dinheiro; preco_atual: Dinheiro; promo_ativa: boolean;
  preco_por: Dinheiro | null; desconto_pct: number; promo_fim: string | null; // só com promo ativa; "AAAA-MM-DD"
};
type ProdutoDetalhe = ProdutoCartao & {
  como_usar: string;                          // já resolvido: do produto ou do departamento
  cuidado: string;
  guias: { slug: string; title: string; tempo_minutos: number }[];
  relacionados: ProdutoCartao[];              // até 4, mesmo departamento
};
type Kit = { slug: string; nome: string; subtitulo: string; icone: Icone;
  itens: { produto: ProdutoCartao; quantidade: number }[] };
type PromocaoPublica = { id: string; titulo: string; texto: string; imagem: Imagem;
  tipo_acao: TipoAcao; produto: ProdutoCartao | null; cta_rotulo: string; cta_caminho: string;
  whatsapp_mensagem: string; publico: PublicoPromocao; frequencia: Frequencia;
  prioridade: number; inicio: string; fim: string };
// Guias reaproveitam os campos de conteúdo do Falcon (title, excerpt, body_markdown, capa, SEO, autor, datas).
type GuiaCartao = { slug: string; title: string; excerpt: string; capa: Imagem;
  publico: PublicoGuia; tempo_minutos: number; etiqueta: string; icone: Icone };
type GuiaDetalhe = GuiaCartao & { body_markdown: string; seo_title: string; seo_description: string;
  published_at: string; produtos: { produto: ProdutoCartao; quantidade: number }[];
  relacionados: GuiaCartao[] };               // até 3, mesmo público ou "ambos"
```

`preco_por`, `promo_fim` e `desconto_pct` só vêm preenchidos com a oferta ativa: oferta agendada
não vaza antes da hora.

### API do CMS

Login e CSRF do Falcon em tudo (sem sessão → 401; sem CSRF em escrita → 403). Escritas parciais
por `PATCH` (só os campos enviados). Rotas fixas (`/reorder`, `/marcas`) declaradas **antes** de
`/{id}` (pegadinha já anotada no Falcon).

| Recurso | Rotas |
| --- | --- |
| Produtos | `GET /api/cms/produtos?q=&departamento=&ativo=&oferta=no_ar\|agendada\|encerrada_recente`, `POST`, `GET/PATCH/DELETE /api/cms/produtos/{id}`, `GET /api/cms/produtos/marcas` |
| Ofertas | as mesmas rotas de produtos (`?oferta=`); encerrar = `PATCH` com `preco_por`, `promo_inicio` e `promo_fim` nulos |
| Departamentos | `GET`, `POST /api/cms/departamentos`, `PATCH/DELETE /{id}`, `PUT /reorder` |
| Kits | `GET`, `POST /api/cms/kits`, `GET/PATCH/DELETE /{id}` (`itens` no corpo substitui a lista), `PUT /reorder` |
| Promoções | `GET`, `POST /api/cms/promocoes`, `GET/PATCH/DELETE /{id}` |
| Guias | rotas de cases do Falcon renomeadas para `/api/cms/guides*`, com `GuideDetail` e `produtos` |
| Artigos, depoimentos, autores, uploads, links de campanha, auth | como no Falcon (artigo com `categoria`) |
| Dados da loja | rota de settings do Falcon, com os campos da seção 9 |
| Métricas | `GET /api/cms/analytics` e `/analytics/pages` do Falcon + blocos da seção 10 |

Erros: 422 com o erro por campo (formato do FastAPI, como no Falcon); 404; 409 para slug
repetido e exclusão bloqueada (`detail` diz onde o item está em uso). Toda escrita em produto,
departamento, kit, promoção, guia, artigo, depoimento ou dados da loja invalida o cache público.

## 12. Identidade visual e regras de texto

**Visual**

- Tokens: copiar como estão o `:root` e o tema escuro de `prototipo/fonte/p1.html`. Principais:
  fundo `#F5F7FF`, superfície `#FFFFFF`, texto `#101B3D`, azul royal `#1B3FA0` (marca e botões),
  amarelo `#FFC727` (bico, brilhos, destaque na faixa escura; botão e foco no tema escuro),
  oferta `#C81E35`, WhatsApp `#177A42`, faixa escura `#0E1A47`, foco no claro `#2563EB`.
  Amarelo nunca como texto sobre fundo claro (contraste insuficiente).
- Tema segue o sistema (`prefers-color-scheme`); `data-theme` força claro/escuro, como no protótipo.
- Fonte: **Nunito** (títulos e texto, pesos 400–900), servida pelo próprio site (pacotes
  `@fontsource*` ou `woff2` em `public/`), sem requisição ao Google Fonts.
- Selo: `prototipo/marca/simbolo.png` (1024 px, fundo transparente). No site, gere a partir dele
  as versões WebP/PNG do topo e rodapé (40 px, com 2x), o favicon e o ícone da casca do CMS. O
  logotipo é o selo + nome em texto HTML Nunito, como no protótipo. Ilustrações de produto e
  ícones: sprites `s-*` e `i-*` do protótipo.
- O selo é raster: fachada, impressão e tamanhos grandes pedem versão vetorial (pendente, com o
  dono). No escuro, a asa marinho tem pouco contraste com o fundo; aceito no protótipo.
- O CMS usa a mesma paleta na casca; o resto da interface do CMS do Falcon fica como está.

**Texto**

- Tom de loja de bairro: "você", frases curtas, sem jargão.
- Nunca a palavra "vitrine".
- Preço sempre "de R$ X por R$ Y" com validade; nunca preço por quantidade, faixa ou "a partir
  de N unidades". Atacado: "preço combinado pelo WhatsApp".
- Sem "nota fiscal para CNPJ".
- Prazo de separação só pelo campo `prazo_separacao` (hoje "Separado em ~30 min", a confirmar
  com a loja); vazio esconde.
- Sem vocabulário de e-commerce: é "lista", "Pôr na lista", "Mandar pelo WhatsApp" — nunca
  "carrinho", "comprar agora", "finalizar pedido". Ao portar, o "Sem carrinho, sem cadastro" do
  protótipo vira "Sem cadastro, é só a lista" (o CA-28 barra "carrinho" mesmo negado).
- Datas `dd/mm`, moeda `R$ 0,00`, saudação "Olá, {loja_nome}!" sem "!" repetido.

## 13. Segurança, privacidade, acessibilidade, SEO e desempenho

**Segurança**

- Herdado do Falcon e mantido: auth, sessão, CSRF, rate limit, allowlist do BFF (acrescentar só
  as rotas da seção 11), cabeçalhos de segurança/CSP (ajustar: `wa.me` como link, frame só de
  `youtube-nocookie.com`), sanitização do `ContentRenderer` (rehype-raw + sanitização própria).
  As caixas Dica/Atenção saem do Markdown, sem liberar HTML novo.
- A API valida tudo; o CMS só ajuda. `cta_caminho` só caminho interno (`/…`, sem `//` nem `\`);
  link de WhatsApp sempre montado com `whatsapp_numero`, nunca URL livre; `maps_url` e
  `instagram_url` só `https://`.
- Uploads com os limites de tipo e tamanho do Falcon.
- Nenhum segredo no repositório; `.env.example` só com nomes de variáveis. Nada de dado,
  conteúdo ou credencial do Falcon.

**Privacidade (LGPD)**

- Lista e cotação nunca vão ao servidor. Eventos sem conteúdo de mensagem, nome ou CNPJ; termo
  de busca saneado (seção 10).
- Página `/privacidade` curta: o que as métricas guardam, que a lista fica no navegador, como
  pedir para esquecer (`tracking/forget`).
- Depoimento só com autorização do cliente (RF-D03).

**Acessibilidade (WCAG 2.2 AA)**

- Contraste nos dois temas; foco visível (`--focus`); tudo operável por teclado (filtros, lista,
  quantidade, popup, cotação).
- `<dialog>` com foco inicial, Esc e retorno do foco (lista e popup); `aria-live` no contador de
  resultados e da lista; erros de formulário ligados ao campo.
- Alvos de toque ≥ 44 px na barra inferior e nos botões de quantidade.
- `alt` vindo do asset; ilustrações decorativas `aria-hidden`; `prefers-reduced-motion`.

**SEO**

- `<title>`, description, canonical e Open Graph por página.
- JSON-LD: `Store` no início e em `/loja` (endereço, `openingHoursSpecification` a partir de
  `horarios`, telefone); `Product` com `Offer` (`price` = preço atual, `priceCurrency` BRL,
  `priceValidUntil` = `promo_fim` com oferta) na página do produto; `Article` em artigos e guias.
- Sitemap com páginas fixas, produtos ativos, guias e artigos publicados; IndexNow ao publicar
  (Falcon). `robots.txt` bloqueia `/cms` e `/api`.

**Desempenho**

- SSR com cache da API; JavaScript só nas ilhas (lista, filtros, popup, cotação, bairro, curtidas).
- Imagens processadas no upload (Falcon), com `width`/`height` e `loading="lazy"` abaixo da dobra.
- Sem script de terceiros (sem mapa embutido, sem pixel).
- Meta: Lighthouse mobile ≥ 90 em desempenho e acessibilidade em `/`, `/produtos` e na página
  de produto; CLS < 0,1 com o popup.

## 14. Critérios de aceite

- **CA-01** Dado o repositório após a fase P0, quando roda `grep -ri falcon` fora de `docs/`,
  então não acha nada, e `pytest`, `ruff`, `npm run test:unit`, `astro check` e `build` passam.
- **CA-02** Dado um produto com `preco_de` 12,90, `preco_por` 9,90 e `promo_fim` amanhã, quando
  abro o site, então vejo "de R$ 12,90 por R$ 9,90", "-23%" e "até dd/mm".
- **CA-03** Dado o mesmo produto, quando passa a meia-noite (São Paulo) do dia seguinte a
  `promo_fim`, então o site mostra só R$ 12,90 sem ninguém mexer e sem build, cache incluído.
- **CA-04** Dado uma oferta com `promo_inicio` amanhã, quando consulto `/api/public/produtos`
  hoje, então o produto vem sem `preco_por` e com `promo_ativa = false`.
- **CA-05** Dado o editor de produto, quando salvo `preco_por` maior ou igual a `preco_de`, ou
  `preco_por` sem `promo_fim`, então recebo 422 com o erro no campo e nada é gravado.
- **CA-06** Dado um produto na lista de um visitante, quando a equipe desativa o produto, então
  ele some do catálogo, do sitemap e da lista do visitante na próxima abertura.
- **CA-07** Dado uma lista com 2 itens, retirada e nome "Ana", quando clico em "Mandar pelo
  WhatsApp", então abre `wa.me/{whatsapp_numero}` com a mensagem exatamente no formato do RF-L03.
- **CA-08** Dado um item salvo no navegador quando custava R$ 10,00, quando o preço passa a
  R$ 11,00, então a lista e a mensagem usam R$ 11,00.
- **CA-09** Dado 2 detergentes na lista, quando ponho um kit com 4 detergentes, então a lista
  fica com 6.
- **CA-10** Dado a cotação sem empresa, quando envio, então aparece erro no campo com foco nele;
  preenchendo só empresa, segmento e frequência, a mensagem não tem as linhas de CNPJ, bairro e
  "Preciso de".
- **CA-11** Dado `bairros_entrega` com "Rio das Pedras", quando digito "rio das pedras", então
  vejo que está na rota e o botão de WhatsApp com "Moro em Rio das Pedras"; com "an", peço mais
  letras.
- **CA-12** Dado que mudo `whatsapp_numero` no CMS, quando recarrego qualquer página, então todos
  os links de WhatsApp usam o número novo, sem build.
- **CA-13** Dado duas promoções de entrada no ar para "todos", com prioridades 1 e 5, quando entro
  no site, então vejo só a de prioridade 5, e nenhuma outra na mesma sessão.
- **CA-14** Dado uma promoção `uma_vez` que fechei, quando volto amanhã, então ela não aparece;
  sendo `diaria`, aparece de novo.
- **CA-15** Dado uma promoção com público `empresa`, quando navego no modo casa, então ela não
  aparece.
- **CA-16** Dado o popup aberto, quando aperto Esc, então ele fecha e o foco volta; o popup nunca
  aparece em `/cms`; no celular ocupa no máximo metade da altura da tela.
- **CA-17** Dado uma promoção tipo `link`, quando salvo `cta_caminho` "https://outro.site" ou
  "//outro.site", então recebo 422.
- **CA-18** Dado um guia com 3 produtos (1 inativo), quando clico em "Pôr tudo na lista", então
  entram os 2 ativos com as quantidades do guia.
- **CA-19** Dado `guides_enabled = false`, quando acesso `/guias`, então recebo 404 e o link sai da
  navegação (o mesmo para artigos).
- **CA-20** Dado um artigo da categoria `testamos`, quando publico, então o site mostra o selo
  "A gente testou" e o CMS mostrou o lembrete editorial ao escolher a categoria.
- **CA-21** Dado nenhum depoimento ativo, quando abro o início, então a seção de depoimentos não
  aparece.
- **CA-22** Dado um produto usado em kit ou guia, quando tento excluí-lo, então recebo 409 com o
  motivo e a sugestão de desativar.
- **CA-23** Dado um clique no WhatsApp da lista, quando o evento chega à API, então grava
  `whatsapp_click` com `target = "lista"` e nada da mensagem; `target` fora do formato dá 422.
- **CA-24** Dado o produto "Água sanitária 2 L", quando busco "agua SANITARIA", então ele aparece.
- **CA-25** Dado o link `/?modo=empresa`, quando navego para outra página, então o modo empresa
  continua.
- **CA-26** Dado nenhuma sessão no CMS, quando chamo qualquer `/api/cms/*` nova, então recebo 401;
  e o BFF recusa rota fora da allowlist.
- **CA-27** Dado a API fora do ar, quando abro `/produtos`, então recebo 503 sem detalhe técnico.
- **CA-28** Dado o build do site, quando um teste varre templates e textos fixos, então não há
  "vitrine", "a partir de N unidades", "nota fiscal", "carrinho" nem "finalizar pedido".
- **CA-29** Dado `/`, `/produtos` e uma página de produto, quando rodo Lighthouse mobile, então
  desempenho e acessibilidade ficam ≥ 90.
- **CA-30** Dado um produto em oferta, quando inspeciono o JSON-LD, então `Offer.price` é o preço
  por e `priceValidUntil` é a data de fim.

## 15. Fases sugeridas para o plano

| Fase | Entrega testável | Depende de |
| --- | --- | --- |
| P0 Cópia e limpeza | Falcon copiado (seção 2), contato/cases/assets removidos, "falcon" renomeado, migration `0001`, testes herdados verdes (CA-01) | — |
| P1 Loja, identidade e layout | `SiteSettings` da seção 9 (API + tela do CMS), tokens/fontes/logo, layout público comum (RF-P01, RF-P10, RF-P12), casca do CMS | P0 |
| P2 Catálogo: API e CMS | tabelas e regras das seções 5, 6 (oferta) e 11; rotas públicas e do CMS; telas Produtos, Ofertas, Departamentos, Kits; seed de desenvolvimento a partir de `p4.html` | P0 |
| P3 Catálogo no site, lista e WhatsApp | início, `/produtos`, `/produtos/{slug}`, `/empresas`, `/loja`, lista, cotação, bairro (seções 3 e 4) | P1, P2 |
| P4 Promoções de entrada | tabela e rotas `promocoes`, tela do CMS com prévia, popup no site (RF-E01..E05) | P2, P3 |
| P5 Guias e artigos | case → guide, `GuideDetail` + produtos, categoria do artigo, renderer (tabela, caixas), páginas (seção 7) | P1, P2 |
| P6 Depoimentos, métricas e SEO | depoimentos no site, eventos e painel (seção 10), JSON-LD, sitemap, robots, `/privacidade` | P3, P4, P5 |
| P7 Verificação | todos os CA, Lighthouse, varredura de textos (seção 12), relatório final | todas |

P4 e P5 podem andar em paralelo depois de P3 se cada uma tiver a sua migration e não mexerem nos
mesmos arquivos (menu do CMS e allowlist do BFF: uma fase de cada vez). Migrations, auth e
contratos de API: sempre em sequência.

## 16. Fora de escopo e em aberto

**Fora de escopo:** venda online, pagamento, conta de cliente, estoque, PDV/ERP, nota fiscal,
preço por quantidade, contato por e-mail, app, migração de dados do Falcon, deploy e infraestrutura.

**Em aberto** (decisão da loja; o site funciona com o padrão indicado):

| Assunto | Padrão até decidir |
| --- | --- |
| WhatsApp, telefone, horários, pagamento, bairros de entrega | Equipe cadastra no CMS; o seed fictício só existe em desenvolvimento |
| Marcas, produtos e preços reais; fotos | Equipe cadastra; sem foto, ilustração por forma/cor |
| "Separado em ~30 min" | Fica no campo `prazo_separacao`, a confirmar com a loja |
| Nota fiscal | Não mencionar |
| Domínio, hospedagem, deploy, usuários do CMS | Tarefa separada, com ordem explícita |
| Guardar cotações como contato no CMS | Não guarda (só WhatsApp); reavaliar se a loja pedir histórico |
| Faixa/banner fixo além do popup | Fora; o popup cobre |
| Produto sem preço ("consulte") | Não suportado (preço obrigatório); reavaliar |
| "Esgotado" | Fora; desativar o produto |
| Testes reais para "A gente testou" | Nenhum publicado até a loja fazer o primeiro |
