# Plano de Implementação: Site e CMS da Falcão Limpeza

> **Data:** 2026-10-20  
> **Spec de referência:** [docs/specs/site-falcao-limpeza.md](../specs/site-falcao-limpeza.md)  
> **Protótipo de referência:** `prototipo/` (ver `prototipo/LEIAME.md`)  
> **Repositório de origem:** `D:\freela-workspace\falcon-advocacia-site` (somente leitura)  
> **Commit de origem do Falcon:** `bcf07ce60ec230f76914bc33e21715a3c77ba3f0`  
> **Modo de execução:** Inline sequencial fase a fase, commits a cada task na branch `main`, push manual pelo usuário.

---

## 0. Contexto autossuficiente

### Produto
A **Falcão Limpeza** é uma loja física de produtos de limpeza no Anil, Rio de Janeiro (Estrada de Jacarepaguá, 5171, pertinho de Rio das Pedras). Atende tanto casas (varejo) quanto empresas (condomínios, restaurantes, salões de beleza, escritórios).  
O site **não vende online**, não possui carrinho de checkout nem pagamento digital. Suas funções principais são:
1. Apresentar o catálogo com o preço da loja física e as ofertas da semana ("de R$ X por R$ Y").
2. Permitir que o cliente monte uma **Lista** de produtos no navegador e a envie pronta para o **WhatsApp** da loja para separação (retirada ou entrega).
3. Permitir que empresas solicitem **Cotações de atacado** pelo WhatsApp (preço combinado).
4. Educar através de **Guias de limpeza** e **Artigos** (incluindo a categoria "A gente testou").
5. Exibir **Depoimentos**, dados institucionais da loja e consulta interativa de bairros atendidos.

Toda a gestão de produtos, promoções de entrada (popup), guias, artigos, depoimentos e configurações é feita pela equipe da loja no **CMS**.

### Arquitetura e Stack
- **Site público:** Astro 5 com SSR (`@astrojs/node` standalone). Páginas dinâmicas consultam o backend no servidor (`src/lib/server/publicContent.ts`, `publicCatalog.ts`). Ilhas interativas React 19 apenas onde há interação do usuário (lista, filtros, popup, formulários).
- **CMS:** SPA React 19 montada em `src/pages/cms/[...path].astro` (`client:only`), `react-router-dom` 7, editor de texto BlockNote (Markdown) e ícones Lucide.
- **BFF / Proxy:** `src/pages/api/[...path].ts` com allowlist estrita em `src/lib/server/apiProxy.ts`; arquivos estáticos e mídia servidos em `src/pages/media/[...path].ts`.
- **Backend / API:** FastAPI + SQLAlchemy async 2.0 + Alembic + PostgreSQL 16 em `backend/src/app/` (`domain/`, `application/services/`, `infrastructure/`, `interfaces/api/v1/routers/`).
- **Autenticação do CMS:** Argon2id, allowlist `CMS_ALLOWED_EMAILS`, comando CLI `python -m app.cli set-password`, sessão em cookie HttpOnly + CSRF, rate limit.
- **Ambiente local:** `compose.yaml` (postgres, backend, frontend).

### Glossário
| Termo | Significado |
| --- | --- |
| Modo casa / empresa | Preferência do visitante (alternador no topo); altera chamadas e destaques sem mudar preços. |
| Preço da loja | `preco_de`: valor de balcão da loja física. |
| Oferta / promoção de preço | Produto com `preco_por < preco_de` em período ativo, exibido como "de R$ X por R$ Y". |
| Promoção de entrada | Modal (popup) configurado no CMS exibido no site público (`Promocao`). |
| Lista | "Carrinho" sem pagamento: itens e quantidades guardados no navegador e exportados para WhatsApp. |
| Cotação | Pedido de orçamento de atacado corporativo enviado pelo WhatsApp. |
| Kit | Conjunto sugerido de produtos e quantidades para um tipo de empresa. |
| Guia | Passo a passo de limpeza com produtos associados ("O que você vai precisar"). |
| Artigo | Conteúdo editorial com categorias (`geral`, `dicas`, `empresas`, `testamos`). |
| Departamento | Categoria estrutural dos produtos no catálogo. |

### Mapa de arquivos
| Diretório / Arquivo | Descrição |
| --- | --- |
| `prototipo/` | Protótipo navegável de referência (somente leitura). |
| `prototipo/fonte/p1.html` | CSS, tipografia e tokens de design (paleta claro/escuro). |
| `prototipo/fonte/p4.html` | Dados para o seed de catálogo de desenvolvimento. |
| `prototipo/marca/` | Imagens da marca (`simbolo.png`, `falcao-*.png`). |
| `docs/specs/site-falcao-limpeza.md` | Especificação de requisitos da Falcão Limpeza. |
| `backend/` | Código FastAPI, SQLAlchemy, Alembic e testes pytest. |
| `src/` | Aplicação Astro e React (site público e CMS). |

### Comandos de execução e teste
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

### O que NÃO fazer
- Não copiar `.env*`, uploads, banco, chaves ou imagens do Falcon Advocacia.
- Não alterar nada dentro de `D:\freela-workspace\falcon-advocacia-site`.
- Não implementar checkout, pagamento online ou cobrança.
- Não usar termos proibidos: "vitrine", "carrinho", "comprar agora", "finalizar pedido", "nota fiscal para CNPJ", "preço por quantidade" ou faixas de volume progressivas.
- Não publicar dados fictícios do protótipo em produção.
- Não fazer push sem ordem explícita do usuário.

---

## Interfaces já definidas

### Enums e Tipos de Domínio
- `SiteScope.TALIMPO = "talimpo"` (ou `"falcao"`)
- `Forma`: `garrafa | galao | spray | pote | caixa | pacote | unidade`
- `Icone`: `casa | cozinha | roupa | banheiro | lixo | vassoura | brilho | gota | balde | caixa`
- `PublicoGuia`: `todos | casa | empresa`
- `PublicoPromocao`: `todos | casa | empresa`
- `TipoAcao`: `link | cupom | aviso`
- `Frequencia`: `uma_vez | diaria | sempre`
- `CategoriaArtigo`: `geral | dicas | empresas | testamos`

### LocalStorage
- `talimpo-modo`: `"casa" | "empresa"`
- `talimpo-lista`: `{ [produto_id: string]: number }`
- `talimpo-promo-vista`: `{ [promocao_id: string]: string }` (data ISO YYYY-MM-DD)

### Regra de Oferta (Backend, `America/Sao_Paulo`)
- `promo_ativa = (preco_por is not None) and (preco_por < preco_de) and (promo_inicio is None or hoje >= promo_inicio) and (hoje <= promo_fim)`
- `desconto_pct = math.floor(((preco_de - preco_por) / preco_de) * 100)`

### Rotas de API
- **Públicas (`/api/public`)**:
  - `GET /site-settings`
  - `GET /departamentos`
  - `GET /produtos` (`?departamento=`, `?q=`, `?oferta=`, `?embalagem_grande=`, `?marca=`, `?ordem=`)
  - `GET /produtos/{slug}`
  - `GET /kits`
  - `GET /promocoes/ativas`
  - `GET /guides`, `GET /guides/{slug}`
  - `GET /articles`, `GET /articles/{slug}`, `POST /articles/{slug}/like`
  - `GET /testimonials`
  - `GET /track.js`, `POST /events`, `POST /tracking/forget`
- **CMS (`/api/cms`)**:
  - `GET, POST /produtos`, `GET, PUT, DELETE /produtos/{id}`, `GET /produtos/marcas`
  - `GET, POST /departamentos`, `PUT, DELETE /departamentos/{id}`, `PUT /departamentos/reorder`
  - `GET, POST /kits`, `PUT, DELETE /kits/{id}`, `PUT /kits/reorder`
  - `GET, POST /promocoes`, `PUT, DELETE /promocoes/{id}`
  - `GET, POST /guides`, `GET, PUT, DELETE /guides/{id}`
  - `GET, PUT /site-settings`
  - Auth, uploads, artigos, autores, depoimentos, links de campanha e analytics herdados do Falcon.

---

## Índice das fases

- [x] **P0 Cópia e limpeza** · Extrair arquivos versionados do Falcon, remover contato, cases e lixo legado, renomear `falcon` para `falcao`/`talimpo`, migration `0001` unificada, passar na validação básica (CA-01).  
  *Arquivos principais:* raiz, `backend/`, `src/`, `compose.yaml`. *Depende de:* —. *Tier:* Pesado (estrutural).
- [x] **P1 Loja, identidade e layout** · `SiteSettings` com dados da loja (API + CMS), tokens de CSS e fontes do protótipo, layout público comum (topo, rodapé, barra mobile, alternador modo), casca do CMS adaptada.  
  *Arquivos principais:* `backend/src/app/domain/.../site_settings*`, `src/layouts/BaseLayout.astro`, `src/shared/`, `src/features/cms/components/CmsLayout/`. *Depende de:* P0. *Tier:* Médio.
- [x] **P2 Catálogo: API e CMS** · Tabelas `departamentos`, `produtos`, `kits`, `kit_itens`; regras de cálculo de oferta e validações 422/409; rotas da API e telas do CMS (Produtos, Ofertas, Departamentos, Kits); script de seed com dados do `p4.html`.  
  *Arquivos principais:* `backend/alembic/versions/*_catalogo.py`, `backend/src/app/...`, `src/features/cms/pages/*`. *Depende de:* P0. *Tier:* Pesado (banco, migrations e regras de negócio).
- [x] **P3 Catálogo no site, lista e WhatsApp** · Páginas `/`, `/produtos`, `/produtos/{slug}`, `/empresas`, `/loja`; ilhas interativas de Lista (modal, badge, persistência), links de WhatsApp formatados, cotação e consulta de bairros atendidos.  
  *Arquivos principais:* `src/pages/index.astro`, `src/pages/produtos/`, `src/pages/empresas.astro`, `src/pages/loja.astro`, `src/features/catalog/`, `src/features/list/`. *Depende de:* P1, P2. *Tier:* Médio.
- [x] **P4 Promoções de entrada** · Tabela e rotas `promocoes`; tela de gestão no CMS com preview; ilha de popup no site público com respeito a público, frequência, Esc e mobile.  
  *Arquivos principais:* `backend/.../promocao*`, `src/features/cms/pages/CmsPromotionsPage/`, `src/features/promotions/`. *Depende de:* P2, P3. *Tier:* Médio.
- [x] **P5 Guias e artigos** · Adaptação de cases para guias (`guide_details`, `guide_produtos`); artigos com nova categoria e selo "A gente testou"; melhorias no `ContentRenderer` (tabelas e caixas Dica/Atenção); páginas `/guias` e `/artigos`.  
  *Arquivos principais:* `backend/.../guides*`, `src/features/cms/pages/GuideEditorPage/`, `src/pages/guias/`, `src/pages/artigos/`. *Depende de:* P1, P2. *Tier:* Médio.
- [x] **P6 Depoimentos, métricas e SEO** · Depoimentos públicos ativos; eventos de analytics (`whatsapp_click`, `lista_add`, `busca`, `popup_*`); JSON-LD estruturado (Store, Product, Offer); sitemap dinâmico e página `/privacidade`.  
  *Arquivos principais:* `src/pages/sitemap.xml.ts`, `backend/.../analytics*`, `src/features/analytics/`, `src/pages/privacidade.astro`. *Depende de:* P3, P4, P5. *Tier:* Médio.
- [x] **P7 Verificação e fechamento** · Execução de todos os 30 critérios de aceite (CA-01 a CA-30), testes de ponta a ponta, varredura de vocabulário proibido, relatório de status e instruções para dados reais da loja.  
  *Arquivos principais:* suite completa de testes (`pytest`, `vitest`, `playwright`). *Depende de:* P0 a P6. *Tier:* Médio.

---

## Fase P0: Cópia e Limpeza (Herdado do Falcon)

> **Objetivo:** Estabelecer o repositório base com os componentes versionados e testados do Falcon, expurgando o subsistema de contato por e-mail, cases legados, dados específicos da advocacia e renomeando o escopo para Falcão Limpeza. Ao final da fase, a suite herdada deve compilar e rodar 100% verde sem resquícios de "falcon" fora de docs/prototipo.  
> **Critério de aceite mestre:** CA-01.

### Tarefa P0.1: Cópia dos arquivos versionados do Falcon via git archive
- **Arquivos impactados:** Raiz (`package.json`, `package-lock.json`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `playwright.config.ts`, `compose.yaml`, `Dockerfile`, `.dockerignore`, `.env.example`, `.gitignore`), subpastas `backend/`, `src/`, `tests/`.
- **Origem:** `D:\freela-workspace\falcon-advocacia-site` (commit `bcf07ce60ec230f76914bc33e21715a3c77ba3f0`).
- **Instruções:**
  1. Extrair os arquivos versionados usando `git -C D:\freela-workspace\falcon-advocacia-site archive HEAD` para diretório temporário.
  2. Mover arquivos e pastas para a raiz deste repositório sem sobrescrever `prototipo/` nem `docs/`.
  3. Não copiar `.env`, `.env.production`, `node_modules`, `.venv`, uploads, banco de dados ou `.pytest_cache`.
- **Teste e Validação:**
  - `git status` mostra novos arquivos versionáveis.
  - `Test-Path prototipo/LEIAME.md` continua verdadeiro e inalterado.
- **Modelo:** Leve (`Gemini 3.8 Flash`).

### Tarefa P0.2: Remoção do subsistema de contato por e-mail e arquivos legados (RF-C03)
- **Arquivos a deletar:**
  - *Arquivos soltos / rascunhos na raiz:* `.thumbnail`, `support.js`, `PLANO_IMPLEMENTACAO.md`, `Falcon Advocacia - Landing.dc.html`, `Landing page Falcon Advocacia.zip`, `ChatGPT Image *.png`, `WhatsApp Image *.jpeg`, `assets/`, `posts/`, `deploy/`.
  - *Backend contato e cases legados:*
    - `backend/src/app/domain/entities/contact_message.py`
    - `backend/src/app/domain/schemas/contact.py`, `backend/src/app/domain/schemas/contact_journey.py`
    - `backend/src/app/domain/repositories/contact_message_repository.py`
    - `backend/src/app/domain/exceptions/contact.py`
    - `backend/src/app/application/services/contact_service.py`, `contact_admin_service.py`, `contact_dispatcher_service.py`, `contact_journey_service.py`
    - `backend/src/app/interfaces/api/v1/routers/contact.py`, `contact_admin.py`
    - `backend/src/app/infrastructure/email/` (despachante e templates de e-mail)
    - `backend/src/app/domain/entities/content.py` (remover referências a `CaseDetail`, `CaseMetric`, `CaseTag`)
    - `backend/src/app/application/services/cms_case_service.py`
    - `backend/src/app/interfaces/api/v1/routers/cases.py`, `cms_cases.py`
  - *Frontend contato e cases legados:*
    - `src/pages/api/contact.ts`
    - `src/lib/contactAreas.ts`
    - `src/lib/server/contact.test.ts`
    - `src/features/cms/pages/CmsContactsPage/`
    - `src/features/cms/services/cmsContacts.service.ts`, `cmsContacts.service.test.ts`
    - `src/features/cms/pages/CaseEditorPage/`
    - `src/features/cms/services/cmsCase.service.ts`, `cmsCase.service.test.ts`
    - `src/shared/components/CaseShowcaseCard/`
    - `tests/e2e/falcon-contact.spec.ts`
- **Arquivos a ajustar:**
  - `src/features/cms/components/CmsLayout/CmsSidebar.tsx`: remover itens de navegação para "Contatos" e "Casos".
  - `src/features/cms/routes.tsx`: remover rotas de contatos e cases.
  - `backend/src/app/main.py`: remover inclusão dos routers de contato e cases.
  - `backend/src/app/infrastructure/config/settings.py`: remover variáveis `RESEND_*`, `CONTACT_*`.
- **Teste e Validação:**
  - Nenhuma importação quebrada no backend ou frontend.
- **Modelo:** Médio (`Claude Sonnet 5.5`).

### Tarefa P0.3: Renomeação de símbolos "falcon" para "falcao"/"talimpo" (RF-C02)
- **Arquivos impactados:**
  - `src/lib/server/falconApiProxy.ts` -> mover para `src/lib/server/apiProxy.ts`
  - `src/lib/server/falconApiProxy.test.ts` -> mover para `src/lib/server/apiProxy.test.ts`
  - `src/pages/api/[...path].ts`: apontar para `apiProxy.ts`
  - `backend/src/app/domain/entities/site.py`: `SiteScope.FALCON` vira `SiteScope.TALIMPO = "talimpo"` (ou `"falcao"`)
  - `backend/src/app/infrastructure/config/settings.py`: `FALCON_API_*` -> `API_*`, `CMS_SITE_SCOPE = "falcao"` (ou `"talimpo"`)
  - `.env.example`: atualizar nomes de variáveis de ambiente.
  - `src/features/cms/services/falconEditorial.test.ts` -> renomear e ajustar para o novo escopo.
  - `tests/e2e/falcon-editorial.spec.ts`, `falcon-analytics.spec.ts` -> renomear para `cms-editorial.spec.ts`, `cms-analytics.spec.ts`.
- **Teste e Validação:**
  - Varredura com `git grep -i falcon`: nenhuma ocorrência fora de `docs/` e `prototipo/`.
- **Modelo:** Leve / Médio.

### Tarefa P0.4: Consolidação da Migration Inicial `0001_initial_talimpo.py`
- **Arquivos impactados:** `backend/alembic/versions/` (deletar as 21 versões herdadas e criar a migration unificada `0001_initial_talimpo.py`).
- **Instruções:**
  1. Definir na migration única todas as tabelas herdadas ativas:
     - `cms_authors` (id, email, full_name, role, password_hash, is_active, created_at, updated_at)
     - `cms_sessions` (id, author_id, token_hash, csrf_token_hash, expires_at, created_at, revoked_at)
     - `content_entries` (id, site, content_type = 'article' | 'guide', slug, title, summary, cover_image_path, cover_image_alt, cover_image_position, cover_image_zoom, status, author_id, first_published_at, published_at, created_at, updated_at)
     - `article_details` (content_id, body_markdown, reading_time_minutes, categoria)
     - `article_likes` (id, content_id, session_hash, created_at)
     - `testimonials` (id, site, author_name, role, quote, avatar_url, ordem, is_active, created_at, updated_at)
     - `site_settings` (site, base herdada)
     - `site_events` (id, site, event, target, occurred_at, session_hash)
     - `campaign_source_links` (identifier, site, utm_source, utm_medium, utm_campaign, utm_content, created_at)
  2. Não incluir tabelas de mensagens de contato nem detalhes de cases legados.
- **Teste e Validação:**
  - `cd backend && uv run alembic upgrade head` executa sem erros em banco limpo.
- **Modelo:** Pesado (`Claude Opus 5.5`).

### Tarefa P0.5: Verificação do CA-01 e suite de testes herdados
- **Arquivos impactados:** Testes unitários e de integração existentes.
- **Instruções:**
  1. Atualizar fixtures e mocks de testes herdados para refletir a remoção de contato e o escopo Falcão Limpeza.
  2. Executar a bateria completa de checagem.
- **Comandos de Validação:**
  - `cd backend && uv run pytest -v` (todos os testes herdados passam)
  - `cd backend && uv run ruff check .`
  - `npm run test:unit`
  - `npx astro check`
  - `npm run build`
  - `git grep -i falcon` (verificar ausência de ocorrências fora de `docs/` e `prototipo/`)
- **Critério de Aceite Atendido:** CA-01.
- **Modelo:** Médio (`Claude Sonnet 5.5`).

---

## Fase P1: Loja, Identidade e Layout

> **Objetivo:** Implementar o modelo e telas de configuração de Dados da Loja (`SiteSettings`), extrair o sistema de tokens e temas do protótipo, construir a casca do site público com navegação responsiva e alternador de modo (casa/empresa), e estilizar a casca do CMS com a identidade da Falcão Limpeza.  
> **Critérios de aceite:** CA-12, CA-25, CA-27.

### Tarefa P1.1: Adaptação de `SiteSettings` no Backend (Dados da Loja)
- **Arquivos impactados:**
  - `backend/src/app/domain/entities/site_settings.py`
  - `backend/src/app/domain/schemas/site_settings.py`
  - `backend/src/app/domain/repositories/site_settings_repository.py`
  - `backend/src/app/application/services/site_settings_service.py`
  - `backend/src/app/interfaces/api/v1/routers/site_settings.py`, `cms_site_settings.py`
  - `backend/tests/test_site_settings.py`
- **Campos da entidade `SiteSettings`:**
  - `nome`: string (default "Falcão Limpeza")
  - `razao_social`: string opcional
  - `cnpj`: string opcional
  - `whatsapp_numero`: string (obrigatório, sanitizado só dígitos com DDI)
  - `telefone_fixo`: string opcional
  - `endereco_completo`: string ("Estrada de Jacarepaguá, 5171 - Anil, Rio de Janeiro - RJ")
  - `referencia_endereco`: string ("pertinho de Rio das Pedras")
  - `horarios`: string com linhas de funcionamento
  - `formas_pagamento`: lista de strings (JSON / array)
  - `bairros_entrega`: lista de strings com os bairros atendidos
  - `prazo_separacao`: string opcional ("Separado em ~30 min")
  - `maps_url`: string validada (`https://...`)
  - `instagram_url`: string opcional (`https://...`)
  - `guides_enabled`: boolean (default True)
  - `articles_enabled`: boolean (default True)
  - `chave_pix`: string opcional
- **Rotas:**
  - `GET /api/public/site-settings`: Retorna configurações públicas.
  - `GET /api/cms/site-settings`: Dados completos para o painel.
  - `PUT /api/cms/site-settings`: Atualização com validação Pydantic (URLs https, whatsapp só dígitos).
- **Teste e Validação:**
  - `backend/tests/test_site_settings.py`:
    - Atualização de `whatsapp_numero` reflete no GET público.
    - Validação de erro 422 para `maps_url` sem `https://`.
- **Modelo:** Médio (`Claude Sonnet 5.5`).

### Tarefa P1.2: Tela de Dados da Loja no CMS (`CmsSettingsPage`)
- **Arquivos impactados:**
  - `src/features/cms/pages/CmsSettingsPage/CmsSettingsPage.tsx`
  - `src/features/cms/pages/CmsSettingsPage/CmsSettingsPage.module.css`
  - `src/features/cms/services/cmsSiteSettings.service.ts`
  - `src/features/cms/pages/CmsSettingsPage/CmsSettingsPage.test.tsx`
- **Funcionalidades:**
  - Formulário com seções: Identificação, Contato & WhatsApp, Endereço & Horários, Pagamento, Bairros de Entrega (tags) e Módulos do Site.
  - Feedback visual de salvamento e validação de erros da API.
- **Teste e Validação:**
  - `npm run test:unit -- src/features/cms/pages/CmsSettingsPage/`
- **Modelo:** Médio (`Claude Sonnet 5.5`).

### Tarefa P1.3: Tokens de Design, Tipografia e Marca (Falcão Limpeza)
- **Arquivos impactados:**
  - `src/styles/tokens.css`, `src/styles/global.css`
  - `public/brand/` ou `src/assets/brand/`: `logo.svg`, `simbolo.svg` (ou `simbolo.png`), `favicon.svg`
- **Origem:** Extrair variáveis CSS de `prototipo/fonte/p1.html` (paleta azul/verde, modo claro e escuro, sombras, raio de borda, `--focus` de 2px contrastante).
- **Teste e Validação:**
  - Compilação dos estilos no Astro sem erros de variáveis ausentes.
- **Modelo:** Leve (`Gemini 3.8 Flash`).

### Tarefa P1.4: Layout Público Comum e Alternador de Modo (Casa/Empresa)
- **Arquivos impactados:**
  - `src/layouts/BaseLayout.astro`
  - `src/shared/components/Header/Header.astro`
  - `src/shared/components/Footer/Footer.astro`
  - `src/shared/components/MobileNav/MobileNav.astro`
  - `src/shared/components/FloatingWhatsApp/FloatingWhatsApp.astro`
  - `src/shared/components/ModeSwitch/ModeSwitch.tsx` (ou script inline)
  - `src/lib/server/publicSettings.ts` (fetch SSR de `site-settings`)
- **Comportamento (RF-P01, RF-P10, CA-12, CA-25):**
  - SSR obtém `site-settings` via BFF/API; links de WhatsApp (`wa.me/{whatsapp_numero}`) utilizam dinamicamente o número salvo.
  - Script executado no `head` para aplicar o modo antes da renderização evitando flash: lê `?modo=empresa` na query string (persiste no `localStorage['talimpo-modo']`) ou lê o valor gravado.
  - Topo com logo, campo de busca que redireciona para `/produtos?q=`, botão "Minha lista" com contador `aria-live`.
  - Barra de navegação inferior mobile (Início, Produtos, Lista, Loja, WhatsApp).
  - Botão flutuante "Fale com a loja" ligado ao WhatsApp.
- **Teste e Validação:**
  - Teste E2E / Vitest para o alternador de modo (CA-25): ao navegar com `?modo=empresa`, o estado persiste no `localStorage`.
  - Verificação de CA-12: alteração do WhatsApp no CMS reflete em todos os componentes sem rebuild.
- **Modelo:** Médio (`Claude Sonnet 5.5`).

### Tarefa P1.5: Casca do CMS com Marca Falcão Limpeza e Tratamento de Erros (RF-P12, CA-27)
- **Arquivos impactados:**
  - `src/features/cms/components/CmsLayout/CmsHeader.tsx`, `CmsSidebar.tsx`, `CmsSidebar.module.css`
  - `src/pages/404.astro`, `src/pages/500.astro`
  - `src/lib/server/apiProxy.ts`
- **Funcionalidades:**
  - Casca do CMS exibe símbolo e nome "Falcão Limpeza".
  - Menu lateral atualizado: Início, Catálogo (Produtos, Ofertas, Departamentos, Kits), Promoções de entrada, Guias, Artigos, Depoimentos, Métricas, Dados da loja.
  - Página 404 customizada com busca e links para as páginas principais.
  - Quando a API estiver indisponível, SSR retorna 503 com tela amigável sem vazar stack trace ou detalhes técnicos (CA-27).
- **Teste e Validação:**
  - `npm run test:unit`
  - `npx astro check`
- **Modelo:** Médio (`Claude Sonnet 5.5`).

---

## Fase P2: Catálogo (API e CMS)

> **Objetivo:** Criar a estrutura completa de catálogo (departamentos, produtos, kits e itens de kits), implementar as regras de oferta e promoções de preço com timezone `America/Sao_Paulo`, construir as telas de gestão no CMS e fornecer um seed de desenvolvimento alimentado por `prototipo/fonte/p4.html`.  
> **Critérios de aceite:** CA-02, CA-03, CA-04, CA-05, CA-22, CA-26.

### Tarefa P2.1: Modelagem e Migration de Catálogo (`0002_create_catalog_tables.py`)
- **Arquivos impactados:**
  - `backend/alembic/versions/20261020_0002_create_catalog_tables.py`
  - `backend/src/app/domain/entities/catalog.py`
  - `backend/src/app/domain/entities/enums.py` (`Forma`, `Icone`)
- **Tabelas criadas:**
  - `departamentos`: `id` (UUID), `nome`, `slug` (unique), `descricao`, `icone` (Enum Icone), `uso`, `cuidado`, `ordem` (int default 0), `is_active` (bool default True), `created_at`, `updated_at`.
  - `produtos`: `id` (UUID), `departamento_id` (FK `departamentos.id`), `nome`, `slug` (unique), `marca`, `tamanho`, `descricao`, `como_usar`, `forma` (Enum Forma), `cor` (varchar 7), `imagem_url`, `imagem_posicao`, `imagem_zoom`, `preco_de` (Numeric(10,2) not null), `preco_por` (Numeric(10,2) nullable), `promo_inicio` (Date nullable), `promo_fim` (Date nullable), `embalagem_grande` (bool default False), `ordem` (int default 0), `is_active` (bool default True), `created_at`, `updated_at`.
  - `kits`: `id` (UUID), `nome`, `slug` (unique), `descricao`, `publico` (varchar: condominio, restaurante, salao, escritorio, etc.), `ordem` (int default 0), `is_active` (bool default True), `created_at`, `updated_at`.
  - `kit_itens`: `id` (UUID), `kit_id` (FK `kits.id` on delete cascade), `produto_id` (FK `produtos.id`), `quantidade` (int >= 1), `ordem` (int default 0).
- **Teste e Validação:**
  - `cd backend && uv run alembic upgrade head`
- **Modelo:** Pesado (`Claude Opus 5.5`).

### Tarefa P2.2: Regras de Negócio de Oferta, Repositórios e Schemas Pydantic
- **Arquivos impactados:**
  - `backend/src/app/domain/schemas/catalog.py`
  - `backend/src/app/domain/repositories/catalog_repository.py`
  - `backend/src/app/application/services/catalog_service.py`
  - `backend/src/app/domain/exceptions/catalog.py`
  - `backend/tests/test_catalog_offers.py`
- **Regras implementadas:**
  - `calcular_oferta(produto, data_referencia=hoje_sp)`:
    - Fuso horário fixo: `America/Sao_Paulo`.
    - `promo_ativa = (preco_por is not None) and (preco_por < preco_de) and (promo_inicio is None or hoje >= promo_inicio) and (hoje <= promo_fim)`.
    - `desconto_pct = math.floor(((preco_de - preco_por) / preco_de) * 100)` se `promo_ativa` else `None`.
    - `preco_atual = preco_por if promo_ativa else preco_de`.
  - Validação de entrada no CMS (CA-05):
    - `preco_por >= preco_de` levanta 422: "Preço promocional deve ser menor que o preço original".
    - `preco_por` presente sem `promo_fim` levanta 422: "Data de término da oferta é obrigatória".
  - Proteção de privacidade comercial pública (CA-04):
    - Na listagem/detalhe público, se `promo_ativa == False`, `preco_por`, `promo_inicio` e `promo_fim` são omitidos ou retornados nulos.
  - Bloqueio de exclusão de produto com vínculos (CA-22):
    - Se o produto estiver em `kit_itens` (ou `guide_produtos`), retorno de 409 Conflict informando o uso e sugerindo desativar (`is_active = False`).
- **Teste e Validação:**
  - `cd backend && uv run pytest backend/tests/test_catalog_offers.py`
  - Testes cobrindo CA-02, CA-03, CA-04, CA-05 e CA-22.
- **Modelo:** Pesado (`Claude Opus 5.5`).

### Tarefa P2.3: Endpoints Públicos e CMS do Catálogo
- **Arquivos impactados:**
  - `backend/src/app/interfaces/api/v1/routers/public_catalog.py`
  - `backend/src/app/interfaces/api/v1/routers/cms_catalog.py`
  - `backend/src/app/main.py`
  - `src/lib/server/apiProxy.ts` (adicionar rotas `/departamentos`, `/produtos*`, `/kits*` na allowlist do BFF)
  - `backend/tests/test_catalog_api.py`
- **Contratos:**
  - `GET /api/public/departamentos`
  - `GET /api/public/produtos` (suporte a filtros: `departamento_slug`, `q`, `oferta=true`, `embalagem_grande=true`, `marca`, ordenação)
  - `GET /api/public/produtos/{slug}` (detalhe com produtos relacionados do mesmo departamento)
  - `GET /api/public/kits` (kits ativos com seus itens e produtos calculados)
  - CMS: CRUD completo com auth para `/api/cms/departamentos`, `/api/cms/produtos`, `/api/cms/kits` e reordenações.
- **Teste e Validação:**
  - `cd backend && uv run pytest backend/tests/test_catalog_api.py`
  - Verificação de 401 sem sessão para `/api/cms/*` (CA-26).
- **Modelo:** Médio (`Claude Sonnet 5.5`).

### Tarefa P2.4: Telas de Gestão do Catálogo no CMS
- **Arquivos impactados:**
  - `src/features/cms/pages/CmsProductsPage/`
  - `src/features/cms/pages/CmsProductEditorPage/`
  - `src/features/cms/pages/CmsDepartmentsPage/`
  - `src/features/cms/pages/CmsKitsPage/`
  - `src/features/cms/pages/CmsOffersPage/`
  - `src/features/cms/services/cmsCatalog.service.ts`
  - `src/features/cms/routes.tsx`
- **Funcionalidades:**
  - Tabela de produtos com foto/ilustração, departamento, preço de/por, badge de oferta ativa e alternador de status ativo.
  - Editor de produtos com preview do cartão e cálculo dinâmico do desconto percentual.
  - Gerenciador de departamentos com reordenação visual.
  - Gerenciador de kits com busca de produtos e definição de quantidades.
  - Aba rápida "Ofertas da Semana" para visualização e edição de prazos de validade.
- **Teste e Validação:**
  - `npm run test:unit -- src/features/cms/`
- **Modelo:** Médio (`Claude Sonnet 5.5`).

### Tarefa P2.5: Script de Seed de Catálogo (`seed-catalogo`)
- **Arquivos impactados:**
  - `backend/src/app/cli.py`
  - `backend/src/app/infrastructure/database/seeds/catalog_seed.py`
- **Origem dos dados:** Extração e normalização dos dados contidos em `prototipo/fonte/p4.html` (departamentos com ícones, ~30 produtos com preços e formatos, kits para empresas e bairros atendidos).
- **Instruções:** O seed deve ser idempotente e rotulado explicitamente como dados de desenvolvimento/demonstração.
- **Comando:** `cd backend && uv run python -m app.cli seed-catalogo`
- **Modelo:** Leve (`Gemini 3.8 Flash`).

---

## Fase P3: Catálogo no Site Público, Lista e WhatsApp

> **Objetivo:** Implementar as páginas públicas do site (`/`, `/produtos`, `/produtos/{slug}`, `/empresas`, `/loja`), a mecânica da Lista no navegador com sincronização de preços e remoção de inativos, a integração de exportação de listas e cotações para o WhatsApp, e a busca no catálogo.  
> **Critérios de aceite:** CA-06, CA-07, CA-08, CA-09, CA-10, CA-11, CA-24, CA-28.

### Tarefa P3.1: Página Inicial (`/`) e Componentes da Home
- **Arquivos impactados:**
  - `src/pages/index.astro`
  - `src/features/home/components/Hero.astro`
  - `src/features/home/components/BenefitsBanner.astro`
  - `src/features/home/components/DepartmentGrid.astro`
  - `src/features/home/components/WeeklyOffers.astro`
  - `src/features/home/components/BusinessCallout.astro`
  - `src/features/home/components/HowListWorks.astro`
  - `src/features/home/components/StoreSummary.astro`
- **Comportamento (RF-P03):**
  - Hero com botão "Ver produtos" e "Como chegar", card de oferta da semana (menor `ordem`).
  - Faixa de vantagens: preço da loja na tela, prazo de separação (vindo do CMS, ocultado se vazio), entrega na região e atacado para empresas com "Preço combinado pelo WhatsApp".
  - Seção "O que está valendo a pena": até 8 produtos com oferta ativa; subtítulo com a menor data de validade ("Válido até dd/mm ou enquanto durar o estoque"); se não houver ofertas ativas, a seção inteira é ocultada.
  - Seção da Loja com mapa ilustrativo ("fora de escala", sem iframe externo), endereço, horário e link para o Google Maps (`maps_url`).
- **Teste e Validação:**
  - `npm run test:unit -- src/features/home/`
  - Verificação de renderização SSR com catálogo vazio e com catálogo populado.
- **Modelo:** Médio (`Claude Sonnet 5.5`).

### Tarefa P3.2: Catálogo Completo (`/produtos`) com Busca e Filtros
- **Arquivos impactados:**
  - `src/pages/produtos/index.astro`
  - `src/features/catalog/components/ProductCatalog.tsx` (Ilha interativa)
  - `src/features/catalog/components/ProductCard.tsx`
  - `src/features/catalog/components/ProductFilters.tsx`
  - `src/features/catalog/utils/productSearch.ts`
- **Comportamento (RF-P02, RF-P04, CA-24):**
  - Renderização SSR inicial com hidratação para filtragem instantânea sem reload.
  - Filtros: Departamento, Faixas de preço (até R$ 10, R$ 10 a R$ 30, > R$ 30), "Só ofertas", "Embalagem grande", e seleção de marcas.
  - Busca (`?q=`): Case-insensitive e sem acento (`normalize('NFD')`), exige a correspondência de todos os termos digitados no nome, marca, departamento ou descrição (CA-24).
  - Estado dos filtros sincronizado na URL para permitir compartilhamento e histórico de navegação.
  - Contador de resultados com `aria-live="polite"`. Mensagem com botão "Limpar filtros" se não houver resultados.
- **Teste e Validação:**
  - Teste unitário para busca (CA-24): buscar "agua SANITARIA" localiza "Água sanitária 2 L".
  - Teste dos filtros por preço e marca.
- **Modelo:** Médio (`Claude Sonnet 5.5`).

### Tarefa P3.3: Página de Detalhes do Produto (`/produtos/{slug}`)
- **Arquivos impactados:**
  - `src/pages/produtos/[slug].astro`
  - `src/features/catalog/components/ProductDetailView.astro`
  - `src/features/catalog/components/ProductQuantitySelector.tsx` (Ilha interativa)
  - `src/features/catalog/components/ProductIllustration.astro` (Sprite SVG / ilustração por `forma` e `cor`)
- **Comportamento (RF-P05, CA-02):**
  - Exibe foto ou ilustração gerada a partir da `forma` e `cor` caso `imagem_url` seja nulo.
  - Preço: se oferta ativa, exibe "de R$ X por R$ Y", badge `-Z%` e validade "até dd/mm"; se inativa, exibe apenas "R$ X".
  - Seletor de quantidade com cálculo de subtotal e botão "Pôr na lista".
  - Blocos informativos: "Como usar" e "Cuidados".
  - Produtos relacionados do mesmo departamento (até 4).
  - No modo empresa, exibe chamada: "Comprando em quantidade? O preço de atacado a gente combina pelo WhatsApp."
  - Retorna 404 caso o produto não exista ou esteja com `is_active = False`.
- **Teste e Validação:**
  - Teste SSR de produto em oferta e sem oferta.
  - Verificação de 404 em produto inativo.
- **Modelo:** Médio (`Claude Sonnet 5.5`).

### Tarefa P3.4: Motor e Interface da Lista (Modal, Sincronização e WhatsApp)
- **Arquivos impactados:**
  - `src/features/list/context/ListContext.tsx`
  - `src/features/list/components/ListModal.tsx` (`<dialog>` acessível)
  - `src/features/list/components/ListButton.tsx` (botão com contador no topo e mobile)
  - `src/features/list/utils/whatsappFormatter.ts`
  - `src/features/list/hooks/useListSync.ts`
  - `src/features/list/tests/list.test.ts`
- **Comportamento (RF-L01..L06, CA-06, CA-07, CA-08, CA-09):**
  - Persistência em `localStorage['talimpo-lista']` com dicionário `{ [produto_id]: quantidade }`.
  - Ao abrir a lista, valida os IDs contra os produtos ativos: produtos inativados são descartados automaticamente (CA-06).
  - Preços exibidos e calculados utilizam SEMPRE o valor atual de balcão do produto (CA-08).
  - Permite alterar quantidades (1 a 999), remover itens ou limpar lista.
  - Escolha de modalidade: "Retirada na loja" ou "Entrega" (com campo Bairro obrigatório se entrega) + campo "Seu nome" (opcional).
  - Botão "Mandar pelo WhatsApp":
    - Monta link `https://wa.me/{whatsapp_numero}?text=...` rigorosamente no formato do RF-L03 (CA-07).
    - Total formatado com "(com o preço da loja)".
- **Teste e Validação:**
  - `npm run test:unit -- src/features/list/`
  - Teste de CA-07: verificação exata do texto gerado no WhatsApp.
  - Teste de CA-08: recálculo automático com preço novo.
  - Teste de CA-09: adição de kit incrementa produtos já existentes na lista.
- **Modelo:** Médio (`Claude Sonnet 5.5`).

### Tarefa P3.5: Página Para Empresas (`/empresas`) e Formulário de Cotação
- **Arquivos impactados:**
  - `src/pages/empresas.astro`
  - `src/features/business/components/KitCard.astro`
  - `src/features/business/components/AddKitToListButton.tsx` (Ilha)
  - `src/features/business/components/QuoteForm.tsx` (Ilha com validação e WhatsApp)
- **Comportamento (RF-P06, RF-L04, CA-09, CA-10):**
  - Apresentação das vantagens do atacado na Falcão Limpeza.
  - Listagem dos kits ativos (com seus itens e quantidades).
  - Botão "Pôr o kit na lista": adiciona todos os produtos do kit na lista de uma vez (CA-09).
  - Formulário de Cotação (RF-L04, CA-10):
    - Campos obrigatórios: Nome da Empresa, Segmento, Frequência estimada.
    - Campos opcionais: CNPJ, Bairro, Necessidades / Produtos.
    - Se enviado sem preencher campos obrigatórios, foca no primeiro campo com erro com indicação de acessibilidade.
    - Ao submeter válido, abre WhatsApp com a mensagem formatada conforme RF-L04 (omitindo linhas opcionais não preenchidas).
- **Teste e Validação:**
  - Teste unitário de validação do formulário e montagem da mensagem de cotação (CA-10).
- **Modelo:** Médio (`Claude Sonnet 5.5`).

### Tarefa P3.6: Página A Loja (`/loja`) e Consulta de Bairros Atendidos
- **Arquivos impactados:**
  - `src/pages/loja.astro`
  - `src/features/store/components/NeighborhoodChecker.tsx` (Ilha interativa)
  - `src/features/store/tests/neighborhoodChecker.test.tsx`
- **Comportamento (RF-P09, CA-11):**
  - Dados completos: endereço, mapa esquemático, horários, telefones, formas de pagamento.
  - Componente "Entrega no seu bairro?":
    - Se texto digitado < 3 caracteres, exibe aviso pedindo mais letras.
    - Compara de forma insensível a acentos e caixa contra a lista `bairros_entrega` de `SiteSettings`.
    - Se encontrado: exibe mensagem de confirmação de rota e botão de WhatsApp com texto pré-definido: "Olá, Falcão Limpeza! Moro em {bairro}. Como funciona a entrega?"
    - Se não encontrado: informa que ainda não está na lista de rotas fixas e convida a consultar a loja no WhatsApp.
- **Teste e Validação:**
  - Teste em `neighborhoodChecker.test.tsx` cobrindo CA-11.
- **Modelo:** Leve / Médio.

### Tarefa P3.7: Varredura de Vocabulário e Regras de Texto (CA-28)
- **Arquivos impactados:** Todos os templates e componentes criados em P1 e P3.
- **Instruções:**
  - Escrever teste automatizado `tests/unit/textRules.test.ts` que varre todos os arquivos `.astro`, `.tsx`, `.ts` e `.html` públicos.
  - Assegurar ausência dos termos proibidos pela Seção 12: "vitrine", "carrinho", "comprar agora", "finalizar pedido", "nota fiscal para CNPJ", "preço por quantidade" ou faixas de volume.
- **Comando de Validação:** `npm run test:unit -- textRules.test.ts`
- **Critério de Aceite Atendido:** CA-28.
- **Modelo:** Leve (`Gemini 3.8 Flash`).

---

## Fase P4: Promoções de Entrada (Popup)

> **Objetivo:** Implementar o subsistema de avisos e promoções de entrada (popup modal), abrangendo modelagem no banco, rotas públicas e administrativas, tela de configuração no CMS com prévia visual, e o componente acessível no site público que respeita público-alvo, frequência, histórico de visualizações e responsividade mobile.  
> **Critérios de aceite:** CA-13, CA-14, CA-15, CA-16, CA-17.

### Tarefa P4.1: Modelagem e Migration de Promoções (`0003_create_promocoes_table.py`)
- **Arquivos impactados:**
  - `backend/alembic/versions/20261020_0003_create_promocoes_table.py`
  - `backend/src/app/domain/entities/promocao.py`
  - `backend/src/app/domain/entities/enums.py` (`TipoAcao`, `PublicoPromocao`, `Frequencia`)
- **Campos da tabela `promocoes`:**
  - `id`: UUID (chave primária)
  - `titulo`: varchar(120) não nulo
  - `subtitulo`: text opcional
  - `tipo_acao`: Enum (`link`, `cupom`, `aviso`)
  - `cta_texto`: varchar(60) opcional
  - `cta_caminho`: varchar(255) opcional (obrigatório se `tipo_acao == 'link'`)
  - `codigo_cupom`: varchar(50) opcional (obrigatório se `tipo_acao == 'cupom'`)
  - `publico`: Enum (`todos`, `casa`, `empresa`) default `todos`
  - `frequencia`: Enum (`uma_vez`, `diaria`, `sempre`) default `uma_vez`
  - `data_inicio`: Date não nulo
  - `data_fim`: Date não nulo
  - `prioridade`: int default 0
  - `is_active`: boolean default True
  - `created_at`, `updated_at`: timestamps
- **Teste e Validação:**
  - `cd backend && uv run alembic upgrade head`
- **Modelo:** Pesado (`Claude Opus 5.5`).

### Tarefa P4.2: Validação de Segurança Pydantic e Serviço de Promoções
- **Arquivos impactados:**
  - `backend/src/app/domain/schemas/promocao.py`
  - `backend/src/app/domain/repositories/promocao_repository.py`
  - `backend/src/app/application/services/promocao_service.py`
  - `backend/tests/test_promocoes.py`
- **Regras implementadas:**
  - Sanitização de caminho de redirecionamento (CA-17):
    - Se `tipo_acao == "link"`, `cta_caminho` deve ser estritamente um caminho relativo interno: começar com `/` e não conter `//`, `\`, nem esquemas `http:`, `https:` ou protocolos externos. Violações retornam 422 Unprocessable Entity.
  - Se `tipo_acao == "cupom"`, `codigo_cupom` é validado como obrigatório e sem espaços.
  - Seleção da promoção ativa no dia (`data_referencia = hoje_sp`):
    - Filtro: `is_active = True`, `data_inicio <= hoje <= data_fim`.
    - Ordenação para desempate (CA-13): `prioridade DESC, created_at DESC, id ASC`.
- **Teste e Validação:**
  - `cd backend && uv run pytest backend/tests/test_promocoes.py`
  - Testes cobrindo validação 422 de URL externa (CA-17) e ordenação por prioridade (CA-13).
- **Modelo:** Médio (`Claude Sonnet 5.5`).

### Tarefa P4.3: Endpoints Públicos e CMS de Promoções
- **Arquivos impactados:**
  - `backend/src/app/interfaces/api/v1/routers/public_promocao.py`
  - `backend/src/app/interfaces/api/v1/routers/cms_promocao.py`
  - `backend/src/app/main.py`
  - `src/lib/server/apiProxy.ts` (allowlist `/promocoes*`)
- **Contratos:**
  - `GET /api/public/promocoes/ativas`: Retorna as promoções ativas vigentes com campos públicos (`id`, `titulo`, `subtitulo`, `tipo_acao`, `cta_texto`, `cta_caminho`, `codigo_cupom`, `publico`, `frequencia`, `prioridade`).
  - `GET /api/cms/promocoes`: Lista completa para administração.
  - `POST /api/cms/promocoes`, `PUT /api/cms/promocoes/{id}`, `DELETE /api/cms/promocoes/{id}`.
- **Teste e Validação:**
  - Testes de rota autenticada e pública em `test_promocoes.py`.
- **Modelo:** Médio (`Claude Sonnet 5.5`).

### Tarefa P4.4: Tela de Gestão de Promoções no CMS com Prévia Visual
- **Arquivos impactados:**
  - `src/features/cms/pages/CmsPromotionsPage/CmsPromotionsPage.tsx`
  - `src/features/cms/pages/CmsPromotionsPage/CmsPromotionEditor.tsx`
  - `src/features/cms/pages/CmsPromotionsPage/CmsPromotionPreview.tsx`
  - `src/features/cms/services/cmsPromotions.service.ts`
  - `src/features/cms/routes.tsx`
- **Funcionalidades:**
  - Tabela com lista de promoções, badge de status (Vigente, Agendada, Encerrada, Inativa), público, frequência e prioridade.
  - Formulário com campos validados e painel lateral com **prévia em tempo real** exatamente no mesmo formato e tema do modal do site.
- **Teste e Validação:**
  - `npm run test:unit -- src/features/cms/pages/CmsPromotionsPage/`
- **Modelo:** Médio (`Claude Sonnet 5.5`).

### Tarefa P4.5: Ilha de Promoção de Entrada no Site Público (`EntryPromotionPopup`)
- **Arquivos impactados:**
  - `src/features/promotions/components/EntryPromotionPopup.tsx`
  - `src/features/promotions/components/EntryPromotionPopup.module.css`
  - `src/features/promotions/hooks/useEntryPromotion.ts`
  - `src/layouts/BaseLayout.astro` (inclusão da ilha)
  - `src/features/promotions/tests/entryPromotion.test.tsx`
- **Comportamento e Regras (RF-E01..E05, CA-13, CA-14, CA-15, CA-16):**
  - **Bloqueio no CMS:** O script/componente verifica a rota atual: se começar com `/cms`, aborta imediatamente e nunca exibe popup (CA-16).
  - **Filtro de Público (CA-15):** Compara o público da promoção (`todos`, `casa`, `empresa`) com o modo atual do visitante (`localStorage['talimpo-modo']`). Se for `empresa` e o visitante estiver em `casa`, não exibe.
  - **Desempate (CA-13):** Entre as promoções elegíveis, seleciona apenas a de maior prioridade. Nenhuma outra promoção é exibida na mesma sessão.
  - **Controle de Frequência via `localStorage['talimpo-promo-vista']` (CA-14):**
    - `uma_vez`: ao fechar ou clicar no CTA, armazena o id; em acessos futuros nunca mais reabre.
    - `diaria`: armazena `{ [id]: "AAAA-MM-DD" }`. Só pode abrir novamente caso a data atual seja posterior à data gravada.
    - `sempre`: grava flag na `sessionStorage` para não reabrir a cada navegação de página dentro da mesma aba.
  - **Acessibilidade e Interação (CA-16):**
    - Renderiza `<dialog>` nativo.
    - Move o foco inicial para o botão de fechar ou para o CTA.
    - Pressionar a tecla **Esc** fecha o popup e devolve o foco para o elemento ativo anterior na página.
    - Copiar cupom: ao clicar em "Copiar código", copia para a área de transferência com feedback visual.
  - **Mobile:** Em telas estreitas, limita a altura a `max-height: 50vh` com rolagem interna para não cobrir a tela inteira.
- **Teste e Validação:**
  - Testes com React Testing Library / Vitest em `entryPromotion.test.tsx`:
    - Respeito à prioridade (CA-13).
    - Frequência diária e única (CA-14).
    - Bloqueio por modo casa/empresa (CA-15).
    - Fechamento com Esc e foco devolvido (CA-16).
- **Modelo:** Médio (`Claude Sonnet 5.5`).

---

## Fase P5: Guias e Artigos

> **Objetivo:** Adaptar o subsistema de conteúdo do Falcon (substituindo cases por guias e vinculando produtos aos passos de limpeza), atualizar o modelo de artigos com categoria e o selo "A gente testou", estender o renderizador Markdown para suporte a tabelas e caixas de destaque, e implementar as páginas públicas e módulos ativáveis/desativáveis no CMS.  
> **Critérios de aceite:** CA-18, CA-19, CA-20.

### Tarefa P5.1: Modelagem e Migration de Guias e Categorias (`0004_create_guides_and_article_categories.py`)
- **Arquivos impactados:**
  - `backend/alembic/versions/20261020_0004_create_guides_and_article_categories.py`
  - `backend/src/app/domain/entities/content.py` (atualizar `content_type` para aceitar `article` e `guide`)
  - `backend/src/app/domain/entities/guide.py` (`GuideDetail`, `GuideProduto`)
  - `backend/src/app/domain/entities/enums.py` (`PublicoGuia`, `CategoriaArtigo`)
- **Tabelas criadas / modificadas:**
  - `guide_details`: `content_id` (FK `content_entries.id` on delete cascade, PK), `publico` (Enum PublicoGuia: `todos`, `casa`, `empresa`), `tempo_estimado` (varchar 30), `dificuldade` (varchar 30), `body_markdown` (text).
  - `guide_produtos`: `id` (UUID, PK), `guide_id` (FK `content_entries.id` on delete cascade), `produto_id` (FK `produtos.id` on delete restrict), `quantidade` (int >= 1), `ordem` (int default 0).
  - `article_details`: alterar coluna `area` para `categoria` (Enum `CategoriaArtigo`: `geral`, `dicas`, `empresas`, `testamos`).
- **Teste e Validação:**
  - `cd backend && uv run alembic upgrade head`
- **Modelo:** Pesado (`Claude Opus 5.5`).

### Tarefa P5.2: Serviços e Endpoints de Guias e Artigos
- **Arquivos impactados:**
  - `backend/src/app/domain/schemas/guide.py`
  - `backend/src/app/domain/schemas/article.py`
  - `backend/src/app/domain/repositories/guide_repository.py`
  - `backend/src/app/application/services/public_content_service.py`
  - `backend/src/app/application/services/cms_guide_service.py`
  - `backend/src/app/interfaces/api/v1/routers/public_guides.py`
  - `backend/src/app/interfaces/api/v1/routers/cms_guides.py`
  - `backend/src/app/interfaces/api/v1/routers/public_articles.py`
  - `backend/src/app/interfaces/api/v1/routers/cms_articles.py`
  - `src/lib/server/apiProxy.ts` (allowlist `/guides*`, `/articles*`)
  - `backend/tests/test_guides_and_articles.py`
- **Comportamento e Regras:**
  - `GET /api/public/guides`: lista de guias com `status = 'published'`, suportando filtro por público (`?publico=`).
  - `GET /api/public/guides/{slug}`: detalhe completo do guia, trazendo os produtos vinculados com dados calculados de preço atual e status `is_active`.
  - `GET /api/public/articles`: lista de artigos com filtro por `categoria`.
  - `GET /api/public/articles/{slug}`: artigo detalhado, autor, curtidas e categoria.
  - CRUD no CMS para guias (`/api/cms/guides`) e artigos (`/api/cms/articles`).
- **Teste e Validação:**
  - `cd backend && uv run pytest backend/tests/test_guides_and_articles.py`
- **Modelo:** Médio (`Claude Sonnet 5.5`).

### Tarefa P5.3: Melhorias no `ContentRenderer` (Tabelas e Caixas de Destaque)
- **Arquivos impactados:**
  - `src/features/content/components/ContentRenderer/ContentRenderer.tsx`
  - `src/features/content/components/ContentRenderer/ContentRenderer.module.css`
  - `src/features/content/components/ContentRenderer/CalloutBlock.tsx`
  - `src/features/content/components/ContentRenderer/TableBlock.tsx`
  - `src/features/content/components/ContentRenderer/ContentRenderer.test.tsx`
- **Melhorias:**
  - Suporte estilizado para tabelas Markdown com `table-responsive`, bordas suaves e alinhamento de texto.
  - Caixas de chamada estilizadas a partir de blockquotes especiais:
    - `> [!TIP]` ou `> **Dica:**`: Caixa azul-clara com ícone de lâmpada/brilho.
    - `> [!WARNING]` ou `> **Atenção:**`: Caixa âmbar/laranja com ícone de alerta.
  - Sanitização HTML rigorosa com `rehype-raw` permitindo apenas tags seguras e bloqueando inline scripts ou atributos perigosos.
- **Teste e Validação:**
  - `npm run test:unit -- ContentRenderer.test.tsx`
- **Modelo:** Médio (`Claude Sonnet 5.5`).

### Tarefa P5.4: Telas de Edição no CMS (`GuideEditorPage` e `ArticleEditorPage`)
- **Arquivos impactados:**
  - `src/features/cms/pages/GuideEditorPage/GuideEditorPage.tsx`
  - `src/features/cms/pages/GuideEditorPage/GuideEditorPage.module.css`
  - `src/features/cms/pages/ArticleEditorPage/ArticleEditorPage.tsx`
  - `src/features/cms/services/cmsGuide.service.ts`
  - `src/features/cms/services/cmsArticle.service.ts`
  - `src/features/cms/routes.tsx`
- **Funcionalidades:**
  - `GuideEditorPage`: Metadados do guia (tempo, dificuldade, público), seletor e ordenação de produtos vinculados (com campo de quantidade para cada produto), e editor BlockNote com Markdown.
  - `ArticleEditorPage`: Campo de seleção de `categoria` (`geral`, `dicas`, `empresas`, `testamos`).
  - Ao selecionar a categoria `testamos`, exibe aviso/lembrete editorial proeminente: "Testes reais feitos pela equipe; sem patrocínio ou promessas fictícias" (CA-20).
- **Teste e Validação:**
  - `npm run test:unit -- src/features/cms/pages/ArticleEditorPage/`
  - Verificação de exibição do lembrete editorial ao escolher `testamos`.
- **Modelo:** Médio (`Claude Sonnet 5.5`).

### Tarefa P5.5: Páginas Públicas de Guias e Artigos com Controle de Habilitação (CA-18, CA-19, CA-20)
- **Arquivos impactados:**
  - `src/pages/guias/index.astro`, `src/pages/guias/[slug].astro`
  - `src/pages/artigos/index.astro`, `src/pages/artigos/[slug].astro`
  - `src/features/guides/components/GuideIngredientsList.tsx` (Ilha "O que você vai precisar")
  - `src/features/articles/components/TestedBadge.astro` (Selo "A gente testou")
  - `src/shared/components/Header/Header.astro` (ocultar links se desabilitado)
- **Comportamento:**
  - **Módulos ativados/desativados (CA-19):**
    - Se `site_settings.guides_enabled == False`, o link "Como usar" é removido da navegação e qualquer acesso a `/guias` ou `/guias/{slug}` responde 404.
    - Se `site_settings.articles_enabled == False`, links para artigos saem do site e acessos a `/artigos` respondem 404.
  - **Bloco de Insumos do Guia (CA-18):**
    - Exibe lista de produtos associados com quantidades.
    - Botão "Pôr tudo na lista": verifica os produtos do guia; se houver produtos inativos, descarta-os e adiciona apenas os produtos ativos com as quantidades prescritas no guia ao `localStorage['talimpo-lista']`.
  - **Selo Editorial (CA-20):**
    - Artigos com `categoria == 'testamos'` exibem o selo exclusivo "A gente testou" no topo do cartão e na página do artigo.
- **Teste e Validação:**
  - Teste de CA-18: guia com 3 produtos (1 inativo), adiciona apenas os 2 ativos à lista.
  - Teste de CA-19: SSR retorna 404 quando `guides_enabled = False`.
  - Teste de CA-20: presença do selo visual em artigo da categoria `testamos`.
- **Modelo:** Médio (`Claude Sonnet 5.5`).

---

## Fase P6: Depoimentos, Métricas e SEO

> **Objetivo:** Adaptar os depoimentos públicos da loja (removendo feature flags legadas), implementar os novos eventos de telemetria da Falcão Limpeza com conformidade à LGPD (sem vazar dados de mensagens ou CNPJ), gerar metadados estruturados JSON-LD ricos e sitemap dinâmico atualizado em tempo real.  
> **Critérios de aceite:** CA-06 (sitemap sem inativos), CA-21, CA-23, CA-30.

### Tarefa P6.1: Depoimentos Públicos no Site e Ocultação quando Vazio (RF-P03, CA-21)
- **Arquivos impactados:**
  - `src/features/testimonials/components/TestimonialGrid.astro`
  - `src/pages/index.astro`, `src/pages/empresas.astro`
  - `backend/src/app/application/services/testimonial_service.py`
- **Comportamento:**
  - Remoção da dependência da flag `PUBLIC_TESTIMONIALS_ENABLED`.
  - Busca apenas depoimentos com `is_active = True`, ordenados por `ordem ASC, created_at DESC`.
  - Se a lista retornada pela API for vazia, a seção inteira de depoimentos é omitida do HTML sem deixar espaços em branco ou títulos vazios (CA-21).
- **Teste e Validação:**
  - Teste SSR de CA-21: banco sem depoimentos ativos -> seção não aparece no DOM da Home.
- **Modelo:** Leve / Médio.

### Tarefa P6.2: Eventos de Analytics da Falcão Limpeza e LGPD (CA-23)
- **Arquivos impactados:**
  - `backend/src/app/domain/entities/site_event.py` (Enum `SiteEventType`)
  - `backend/src/app/domain/schemas/analytics.py`
  - `backend/src/app/application/services/analytics_service.py`
  - `backend/src/app/interfaces/api/v1/routers/public_analytics.py`
  - `src/features/analytics/services/trackEvent.ts`
  - `backend/tests/test_analytics.py`
- **Novos Tipos de Eventos (`SiteEventType`):**
  - `whatsapp_click`: cliques para WhatsApp.
    - Validação de `target` estrita: aceita apenas `"lista"`, `"cotacao"`, `"bairro"`, `"produto"` ou `"flutuante"`. Qualquer outro valor retorna 422 Unprocessable Entity (CA-23).
    - **Privacidade absoluta (LGPD):** Nenhum dado de mensagem, nome, telefone, lista de produtos ou CNPJ pode ser enviado ou salvo no backend (CA-23).
  - `lista_add`: adição de produto à lista (`target = produto_id`).
  - `busca`: termo pesquisado no catálogo (`target = termo_saneado`, normalizado, max 50 chars).
  - `popup_view`, `popup_click`, `popup_close`: ciclo de visualização das promoções de entrada (`target = promocao_id`).
- **Teste e Validação:**
  - `cd backend && uv run pytest backend/tests/test_analytics.py`
  - Teste de CA-23: payload com `whatsapp_click` e `target="lista"` grava evento; payload com texto da mensagem ou target livre retorna 422.
- **Modelo:** Médio (`Claude Sonnet 5.5`).

### Tarefa P6.3: Painel de Métricas Adaptado no CMS (`CmsAnalyticsPage`)
- **Arquivos impactados:**
  - `src/features/cms/pages/CmsAnalyticsPage/CmsAnalyticsPage.tsx`
  - `src/features/cms/pages/CmsAnalyticsPage/CmsAnalyticsPanels.tsx`
  - `src/features/cms/services/cmsAnalytics.service.ts`
- **Funcionalidades:**
  - Painéis de acompanhamento com cards de métricas-chave:
    - Cliques no WhatsApp (total e por origem: lista, cotação, bairro, flutuante).
    - Produtos mais adicionados à lista.
    - Termos mais pesquisados na busca do catálogo.
    - Performance de promoções de entrada (exibições vs. cliques no CTA vs. fechamentos).
- **Teste e Validação:**
  - `npm run test:unit -- src/features/cms/pages/CmsAnalyticsPage/`
- **Modelo:** Médio (`Claude Sonnet 5.5`).

### Tarefa P6.4: Metadados Estruturados JSON-LD, Sitemap Dinâmico e Privacidade (CA-06, CA-30)
- **Arquivos impactados:**
  - `src/pages/sitemap.xml.ts`
  - `src/features/seo/components/StoreJsonLd.astro`
  - `src/features/seo/components/ProductJsonLd.astro`
  - `src/features/seo/components/ArticleJsonLd.astro`
  - `src/pages/privacidade.astro`
  - `src/pages/robots.txt.ts` (ou `public/robots.txt`)
- **Comportamento:**
  - **Sitemap Dinâmico (CA-06):**
    - Inclui rotas fixas do site.
    - Inclui produtos ativos (`is_active = True`). Produtos inativos são sumariamente excluídos do sitemap.
    - Inclui guias e artigos publicados (apenas se seus respectivos módulos estiverem habilitados nas configurações).
  - **JSON-LD Estruturado (CA-30):**
    - `Store` em `/` e `/loja`: Nome, endereço completo, telefone, horários formatados com `openingHoursSpecification`.
    - `Product` em `/produtos/{slug}`: Nome, descrição, imagem, `Offer`:
      - Se produto em oferta ativa: `Offer.price` é o `preco_por` e `Offer.priceValidUntil` é a data ISO de `promo_fim` (CA-30).
      - Se preço regular: `Offer.price` é o `preco_de` sem `priceValidUntil`.
  - **Robots.txt:** Bloqueia indexação de `/cms` e `/api`.
  - **Página `/privacidade`:** Texto conciso explicando que a lista fica no navegador do usuário, como esquecer dados (`tracking/forget`) e conformidade com a LGPD.
- **Teste e Validação:**
  - Teste de CA-30: validação do JSON-LD em produto com oferta.
  - Teste de CA-06: verificação de que produtos inativos não constam em `sitemap.xml`.
- **Modelo:** Médio (`Claude Sonnet 5.5`).

---

## Fase P7: Verificação e Fechamento

> **Objetivo:** Executar a bateria integral de testes dos 30 critérios de aceite da especificação, assegurar conformidade do Lighthouse mobile (>= 90), realizar auditoria de termos e vocabulário proibido, e produzir a documentação final de entrega e operabilidade.  
> **Critérios de aceite:** Validação completa de CA-01 a CA-30.

### Tarefa P7.1: Bateria Completa de Testes Automatizados (CA-01 a CA-30)
- **Arquivos impactados:** Suites de testes em `backend/tests/`, `src/.../*.test.ts*` e `tests/e2e/`.
- **Execução:**
  1. `cd backend && uv run pytest -v` (100% dos testes verdes).
  2. `cd backend && uv run ruff check .`
  3. `npm run test:unit` (100% dos testes verdes).
  4. `npx astro check`
  5. `npm run build`
  6. `npm run test:e2e` (Playwright nos fluxos de usuário e CMS).
- **Modelo:** Médio (`Claude Sonnet 5.5`).

### Tarefa P7.2: Auditoria de Performance e Acessibilidade com Lighthouse (CA-29)
- **Rotas auditadas:** `/`, `/produtos`, `/produtos/{slug}`.
- **Metas exigidas:**
  - Lighthouse Mobile: Pontuação >= 90 em Performance e >= 90 em Accessibility.
  - Cumulative Layout Shift (CLS) < 0.1 mesmo com a renderização do popup de promoção.
- **Comando:** `npx lhci autorun` ou execução via DevTools/Playwright.
- **Modelo:** Médio (`Claude Sonnet 5.5`).

### Tarefa P7.3: Auditoria Final de Texto e Isolamento (CA-01, CA-28)
- **Instruções:**
  1. Executar varredura estrita de nomes herdados:
     `git grep -i falcon`
     Confirmar que nenhuma ocorrência existe fora de `docs/` e `prototipo/`.
  2. Executar teste de vocabulário da loja física:
     Confirmar ausência total de "vitrine", "carrinho", "comprar agora", "finalizar pedido", "nota fiscal para CNPJ" e "preço por quantidade".
- **Modelo:** Leve (`Gemini 3.8 Flash`).

### Tarefa P7.4: Relatório Final de Entrega e Guia de Operação Local
- **Instruções:**
  - Gerar relatório detalhando:
    1. O que foi mantido do Falcon (Auth Argon2id, Uploads, Editor Markdown, Métricas base, Sitemap, Docker).
    2. O que foi adaptado (Cases -> Guias, Categorias de artigos, SiteSettings da loja, Casca do CMS, layout público do protótipo).
    3. O que foi removido (Contato por e-mail, templates Resend, flags obsoletas, ativos do Falcon).
    4. Guia passo a passo para inicialização local:
       - Subir banco: `docker compose up -d postgres`
       - Migrations: `cd backend && uv run alembic upgrade head`
       - Criar usuário administrador: `cd backend && uv run python -m app.cli set-password admin@falcaolimpeza.com.br`
       - Popular dados de teste: `cd backend && uv run python -m app.cli seed-catalogo`
       - Rodar frontend: `npm run dev`
    5. Mapeamento dos itens da Seção 16 em aberto que dependem de dados reais fornecidos pela loja física.
- **Modelo:** Médio (`Claude Sonnet 5.5`).

---

## Conflitos e Divergências entre Spec e Falcon

| Item | Implementação no Falcon Advocacia | Diretriz na Falcão Limpeza (Spec) | Impacto no Plano / Resolução |
| --- | --- | --- | --- |
| **Escopo e Namespace** | Usava `SiteScope.FALCON = "falcon"` e prefixos `FALCON_*`. | Usa `SiteScope.TALIMPO = "talimpo"` (ou `"falcao"`) e prefixos neutros `API_*`. | Migrado de forma limpa na Tarefa P0.3 sem resquícios do nome antigo no código. |
| **Atendimento e Contato** | Formulário de contato web com envio de e-mail via Resend, tabelas de mensagens e despachante em background. | 100% via WhatsApp (`wa.me/{whatsapp_numero}`) com mensagens estruturadas no navegador. | Removido integralmente na Tarefa P0.2 (RF-C03), eliminando dependências externas e simplificando o backend. |
| **Cases vs. Guias** | Possuía `CaseDetail`, `CaseMetric`, `CaseTag` para casos de sucesso jurídico. | Possui `GuideDetail` e `GuideProduto` vinculando insumos do catálogo a passos de limpeza. | Adaptado na Fase P5 aproveitando a tabela polimórfica `content_entries` (`content_type = 'guide'`). |
| **Visibilidade de Depoimentos** | Controlado pela feature flag `PUBLIC_TESTIMONIALS_ENABLED` nas configurações. | Sempre públicos no site, filtrados unicamente por `is_active = True`. | Flag eliminada na Tarefa P6.1, simplificando a lógica do CMS e do site público. |
| **Carrinho vs. Lista** | Não aplicável no Falcon (não havia produtos). | Apenas Lista de WhatsApp sem checkout ou pagamento; proibido usar termos de e-commerce. | Módulo da Lista (P3) construído com foco exclusivo na formatação de mensagens para o WhatsApp da loja. |
