# Protótipo — Falcão Limpeza (Anil)

Protótipo navegável (um arquivo HTML, sem backend) do site da loja de produtos de limpeza
no Anil (Estrada de Jacarepaguá, 5171, pertinho de Rio das Pedras). Serve de referência
visual e de conteúdo para o site real — ver `docs/specs/site-falcao-limpeza.md`.

Publicado (privado) em: https://claude.ai/artifact/FXSvqFFt2YtWNjiTyuKSnL

## Abrir

- Direto: abra `index.html` no navegador (segue o tema do sistema) ou `claro.html` (força o claro).
- Com servidor: config `prancha` em `.claude/launch.json` (`python -m http.server 4399`).

## Editar e montar

A fonte fica em `fonte/p1..p7.html`, concatenadas em ordem:

| Parte | Conteúdo |
| --- | --- |
| p1 | CSS (tokens da paleta azul royal e amarelo, claro/escuro, componentes) |
| p2 | cabeçalho, início, produtos, produto |
| p3 | empresas, guias, guia, "a gente testou", loja, painel, barra do celular, lista, rodapé |
| p4 | dados de exemplo (departamentos, produtos, kits, guias, bairros) e regra de promoção |
| p5 | roteador, cartões, lista |
| p6 | filtros, página do produto, kits |
| p7 | painel (cadastro demo), cotação, ações |

```bash
node prototipo/build.js
```

Gera `falcao-limpeza.html` (corpo usado no artifact), `index.html` e `claro.html`, e falha se o
script do app tiver erro de sintaxe.

## Pastas

- `marca/` — `simbolo.png`, o selo em uso (proposta 3 do Codex, 1024 px, fundo transparente). No
  protótipo ele vai embutido no CSS (`.mark` em p1, WebP de 160 px); o nome ao lado é texto HTML.
  Raster: para fachada ou impressão, pedir a versão vetorial.
- `marca/codex/` — as 3 propostas originais do Codex (`falcao-1..3.png`, fundo branco) e
  `comparativo.png`.
- `prints/` — `claro.png`, `escuro.png`, `celular.png` (versão atual).
- `historico/` — primeira versão, antes da marca atual e das regras de texto abaixo.

## Decisões que valem para o site real

- Loja física: **não vende online**. O site mostra preço, monta lista e manda pelo WhatsApp.
- Promoção sempre como "de R$ X por R$ Y", com data de validade.
- Atacado: **preço combinado pelo WhatsApp**. Nunca prometer faixa de preço por quantidade
  ("cai a partir de 4 unidades" etc.).
- Sem "nota fiscal para CNPJ" no texto (até a loja confirmar).
- "Separado em ~30 min" fica, mas está **a confirmar com a loja**.
- Telefone, horário, marcas e preços do protótipo são **fictícios/provisórios**.
- Nunca usar a palavra "vitrine" no texto do site.
